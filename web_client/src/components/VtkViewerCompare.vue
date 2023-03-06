<script lang="ts">
import { vec3 } from 'gl-matrix';

import { mapState, mapGetters, mapMutations } from 'vuex';

import CrosshairSet from '../utils/crosshairs';
import fill2DView from '../utils/fill2DView';
import { VIEW_ORIENTATIONS, ijkMapping } from '../vtk/constants';

export default {
  name: 'VtkViewer',
  components: {},
  props: {
    view: {
      default: () => ({}),
      required: true,
      type: Object,
    },
    proxyNum: {
      default: 0,
      required: false,
      type: Number,
    },
  },
  data: () => ({
    slice: null,
    // helper to avoid size flickering
    resized: false,
    fullscreen: false,
    screenshotContainer: document.createElement('div'),
    crosshairSet: [],
  }),
  computed: {
    ...mapState([
      'proxyManager',
      'loadingFrame',
      'showCrosshairs',
      'iIndexSlice',
      'jIndexSlice',
      'kIndexSlice',
      'currentWindowWidth',
      'currentWindowLevel',
      'renderOrientation',
    ]),
    ...mapGetters([
      'currentScan',
    ]),
    // Returning representation from VTK
    representation() {
      console.log('VtkViewerCompare - representation: Running');
      return (
        this.proxyManager[this.proxyNum].getRepresentation(null, this.view)
      );
    },
    sliceDomain() {
      console.log('VtkViewerCompare - sliceDomain: Running');
      if (!this.representation) return null;
      console.log('VtkViewerCompare - sliceDomain: PropertyDomainByName', this.representation.getPropertyDomainByName('slice'));
      return this.representation.getPropertyDomainByName('slice');
    },
    name() : ('x' | 'y' | 'z') {
      return this.view.getName();
    },
    displayName() {
      switch (this.name) {
        case 'x':
          return 'Sagittal';
        case 'y':
          return 'Coronal';
        case 'z':
          return 'Axial';
        default:
          return '';
      }
    },
    ijkName() : ('i' | 'j' | 'k') {
      return ijkMapping[this.name];
    },
    keyboardBindings() {
      switch (this.name) {
        case 'z':
          return ['q', 'w', 'e'];
        case 'x':
          return ['a', 's', 'd'];
        case 'y':
          return ['z', 'x', 'c'];
        default:
          return '';
      }
    },
  },
  watch: {
    slice(value) {
      console.log('VtkViewerCompare - slice: Value changed', value);
      this.representation.setSlice(value);
      if (this.SET_CURRENT_VTK_INDEX_SLICES) {
        console.log('VtkViewerCompare - slice: whichProxy', this.proxyNum);
        this.SET_CURRENT_VTK_INDEX_SLICES({
          indexAxis: ijkMapping[this.trueAxis(this.name)],
          value: this.representation.getSliceIndex(),
          whichProxy: this.proxyNum,
        });
      }
    },
    iIndexSlice: {
      deep: true,
      immediate: true,
      handler() {
        console.log('VtkViewerCompare - slice: iIndexSlice changed', this.iIndexSlice[this.proxyNum]);
        this.updateCrosshairs(this.proxyNum);
      },
    },
    jIndexSlice: {
      deep: true,
      immediate: true,
      handler() {
        console.log('VtkViewerCompare - slice: jIndexSlice changed', this.jIndexSlice[this.proxyNum]);
        this.updateCrosshairs(this.proxyNum);
      },
    },
    kIndexSlice: {
      deep: true,
      immediate: true,
      handler() {
        console.log('VtkViewerCompare - slice: kIndexSlice changed', this.kIndexSlice[this.proxyNum]);
        this.updateCrosshairs(this.proxyNum);
      },
    },
    // This seems like what would cause the image to be cleaned up
    view(view, oldView) {
      console.log('VtkViewerCompare - view changed: new, old', view, oldView);
      this.cleanup();
      oldView.setContainer(null);
      this.initializeSlice();
      this.initializeView();
    },
    currentScan() {
      console.log('VtkViewerCompare - currentScan: value changed');
      this.initializeSlice();
      this.initializeCamera();
    },
    showCrosshairs() {
      console.log('VtkViewerCompare - showCrosshairs: value changed');
      this.updateCrosshairs(this.proxyNum);
    },
  },
  mounted() {
    console.log('VtkViewerCompare - mounted');
    this.prepareViewer();
  },
  beforeUnmount() {
    console.log('VtkViewerCompare - before unmount');
    this.cleanup();
  },
  methods: {
    ...mapMutations([
      'SET_CURRENT_VTK_INDEX_SLICES',
      'SET_SLICE_LOCATION',
    ]),
    prepareViewer() {
      console.log('VtkViewerCompare - prepareViewer: Running');
      this.initializeView();
      this.initializeSlice();
      this.initializeCamera();
      this.updateCrosshairs(this.proxyNum);
      this.renderSubscription = this.view.getInteractor().onRenderEvent(() => {
        this.updateCrosshairs(this.proxyNum);
      });
      this.resizeObserver = new window.ResizeObserver((entries) => {
        if (entries.length === 1 && this.$refs.viewer && this.$refs.crosshairsCanvas) {
          const width = this.$refs.viewer.clientWidth;
          const height = this.$refs.viewer.clientHeight;
          this.$refs.crosshairsCanvas.width = width;
          this.$refs.crosshairsCanvas.height = height;
          this.$refs.crosshairsCanvas.style.width = `${width}px`;
          this.$refs.crosshairsCanvas.style.height = `${height}px`;
          this.initializeCamera();
          this.updateCrosshairs(this.proxyNum);
        }
      });
      this.resizeObserver.observe(this.$refs.viewer);
      const representationProperty = this.representation.getActors()[0].getProperty();
      representationProperty.setColorWindow(this.currentWindowWidth);
      representationProperty.setColorLevel(this.currentWindowLevel);
    },
    initializeSlice() {
      console.log('VtkViewerCompare - initializeSlice: Running');
      if (this.name !== 'default') {
        console.log('VtkViewerCompare - initializeSlice: this.name', this.name);
        this.slice = this.representation.getSlice();
      }
    },
    initializeView() {
      console.log('VtkViewerCompare - initializeView: Running');
      this.view.setContainer(this.$refs.viewer);
      fill2DView(this.view);
      if (this.name !== 'default') {
        this.modifiedSubscription = this.representation.onModified(() => {
          if (!this.loadingFrame) {
            this.slice = this.representation.getSlice();
          }
        });
      }
      // add click interaction to place crosshairs
      this.view.getInteractor().onLeftButtonPress((event) => this.placeCrosshairs(event));
      // remove drag interaction to change window
      const targetManipulator = this.view.getInteractor()
        .getInteractorStyle().getMouseManipulators().find(
          (manipulator) => manipulator.getClassName() === 'vtkMouseRangeManipulator',
        );
      if (targetManipulator) {
        targetManipulator.setDragEnabled(false);
      }
      setTimeout(() => {
        this.resized = true;
      });
    },
    initializeCamera() {
      console.log('VtkViewerCompare - initializeCamera: Running');
      const camera = this.view.getCamera();
      const orientation = this.representation.getInputDataSet().getDirection();

      let newViewUp = VIEW_ORIENTATIONS[this.renderOrientation][this.name].viewUp.slice();
      let newDirectionOfProjection = VIEW_ORIENTATIONS[
        this.renderOrientation
      ][this.name].directionOfProjection;
      newViewUp = this.findClosestColumnToVector(
        newViewUp,
        orientation,
      );
      newDirectionOfProjection = this.findClosestColumnToVector(
        newDirectionOfProjection,
        orientation,
      );

      camera.setDirectionOfProjection(...newDirectionOfProjection);
      camera.setViewUp(...newViewUp);

      this.view.resetCamera();
      fill2DView(this.view);
    },
    findClosestColumnToVector(inputVector, matrix) {
      console.log('VtkViewerCompare - findClosestColumnToVector: Running');
      let currClosest = null;
      let currMax = 0;
      const inputVectorAxis = inputVector.findIndex((value) => value !== 0);
      for (let i = 0; i < 3; i += 1) {
        const currColumn = matrix.slice(i * 3, i * 3 + 3);
        const currValue = Math.abs(currColumn[inputVectorAxis]);
        if (currValue > currMax) {
          currClosest = currColumn;
          currMax = currValue;
        }
      }
      const flipCurrClosest = vec3.dot(
        inputVector,
        currClosest,
      );
      if (flipCurrClosest < 0) {
        currClosest = currClosest.map((value) => value * -1);
      }
      return currClosest;
    },
    trueAxis(axisName) {
      console.log('VtkViewerCompare - trueAxis: Running');
      if (!this.representation.getInputDataSet()) return undefined;
      const orientation = this.representation.getInputDataSet().getDirection();
      const axisNumber = VIEW_ORIENTATIONS[this.renderOrientation][axisName].axis;
      const axisOrientation = [
        orientation[axisNumber],
        orientation[3 + axisNumber],
        orientation[6 + axisNumber],
      ].map(
        (val) => Math.abs(val),
      );
      const axisOrdering = ['x', 'y', 'z'];
      const trueAxis = axisOrdering[
        axisOrientation.indexOf(Math.max(...axisOrientation))
      ];
      return trueAxis;
    },
    changeSlice(newValue) {
      console.log('VtkViewerCompare - changeSlice: Running');
      this.slice = newValue;
    },
    roundSlice(value) {
      console.log('VtkViewerCompare - roundSlice: Running');
      if (!value) return '';
      return Math.round(value * 100) / 100;
    },
    drawLine(ctx, displayLine) {
      console.log('VtkViewerCompare - drawLine: Running');
      if (!displayLine) return;
      ctx.strokeStyle = displayLine.color;
      ctx.beginPath();
      ctx.moveTo(...displayLine.start);
      console.log('VtkViewerCompare - drawLine: displayLine.start', displayLine.start);
      ctx.lineTo(...displayLine.end);
      console.log('VtkViewerCompare - drawLine: displayLine.end', displayLine.end);
      ctx.stroke();
    },
    updateCrosshairs(proxyNum) {
      console.log('VtkViewerCompare - updateCrosshairs: Running');
      console.log(`VtkViewerCompare - updateCrosshairs: proxyNum is ${proxyNum}`);
      const myCanvas: HTMLCanvasElement = document.getElementById(`crosshairs-${this.name}`) as HTMLCanvasElement;
      if (myCanvas && myCanvas.getContext) {
        const ctx = myCanvas.getContext('2d');
        ctx.clearRect(0, 0, myCanvas.width, myCanvas.height);

        if (this.showCrosshairs) {
          this.crosshairSet[proxyNum] = new CrosshairSet(
            this.name,
            this.ijkName,
            this.representation,
            this.view,
            myCanvas,
            this.iIndexSlice[this.proxyNum],
            this.jIndexSlice[this.proxyNum],
            this.kIndexSlice[this.proxyNum],
          );
          console.log(`VtkViewerCompare - updateCrosshairs: this.crosshairSet[proxyNum], proxyNum is ${proxyNum}`, this.crosshairSet[proxyNum])
          const originalColors = {
            x: '#fdd835',
            y: '#4caf50',
            z: '#b71c1c',
          };
          const trueColors = Object.fromEntries(
            Object.entries(originalColors).map(([axisName, hex]) => [this.trueAxis(axisName), hex]),
          );
          const [displayLine1, displayLine2] = this.crosshairSet[proxyNum].getCrosshairsForAxis(
            this.trueAxis(this.name),
            trueColors,
          );
          // console.log('VtkViewerCompare - updateCrosshairs - displayLine1, displayLine2', displayLine1, displayLine2);
          this.drawLine(ctx, displayLine1);
          this.drawLine(ctx, displayLine2);
        }
      }
    },
    /**
     * Place crosshairs at the location of a click event
     *
     * @param clickEvent
     */
    placeCrosshairs(clickEvent) {
      console.log('VtkViewerCompare - placeCrosshairs: Running');
      this.crosshairSet[this.proxyNum] = new CrosshairSet(
        this.name,
        this.ijkName,
        this.representation,
        this.view,
        null,
        this.iIndexSlice[this.proxyNum],
        this.jIndexSlice[this.proxyNum],
        this.kIndexSlice[this.proxyNum],
      );
      console.log('VtkViewerCompare - placeCrosshairs: this.crosshairSet[this.proxyNum]', this.crosshairSet[this.proxyNum])
      const location = this.crosshairSet[this.proxyNum].locationOfClick(clickEvent);
      this.SET_SLICE_LOCATION(location, this.proxyNum);
    },
    cleanup() {
      console.log('VtkViewerCompare - cleanup: Running');
      if (this.renderSubscription) {
        this.renderSubscription.unsubscribe();
        this.resizeObserver.unobserve(this.$refs.viewer);
      }
      if (this.modifiedSubscription) {
        this.modifiedSubscription.unsubscribe();
      }
    },
  },
};
</script>

<template>
  <div
    class="vtk-viewer"
    style="font-size: 20px"
  >
    <div
      v-if="name !== 'default'"
      :class="name"
      class="header"
    >
      <v-row class="align-center ma-0">
        <v-slider
          v-mousetrap="[
            { bind: keyboardBindings[1], handler: () => changeSlice(slice + 1) },
            { bind: keyboardBindings[0], handler: () => changeSlice(slice - 1) },
          ]"
          :value="slice"
          :min="sliceDomain.min"
          :max="sliceDomain.max"
          :step="sliceDomain.step"
          class="slice-slider mt-0 mx-4"
          hide-details
          @input="changeSlice"
        />
        <div class="slice text-caption px-2">
          {{ roundSlice(slice) }} mm
        </div>
      </v-row>
    </div>
    <div
      class="viewer"
    >
      <div
        ref="viewer"
        :style="{ visibility: resized ? 'unset' : 'hidden' }"
      />
      <canvas
        :id="'crosshairs-' + name"
        ref="crosshairsCanvas"
        class="crosshairs"
      />
    </div>
    <v-toolbar
      class="toolbar"
      dark
      flat
      color="#ffffff00"
      height="46"
      max-height="46"
    >
      <div
        :class="name"
        class="indicator text-body-2"
      >
        {{ displayName }}
      </div>
      <v-spacer />
    </v-toolbar>
  </div>
</template>

<style lang="scss" scoped>
.vtk-viewer {
  // position: absolute;
  // top: 0;
  // bottom: 0;
  // left: 0;
  // right: 0;
  background: black;
  z-index: 0;

  .slice-slider .v-slider {
    height: 23px;
  }

  .header {
    .slice {
      height: 23px;
      line-height: 23px;
      color: white;
    }

    &.z {
      background-color: #ef5350;

      .slice {
        background-color: #b71c1c;
      }
    }

    &.x {
      background-color: #fdd835;

      .slice {
        background-color: #f9a825;
      }
    }

    &.y {
      background-color: #4caf50;

      .slice {
        background-color: #1b5e20;
      }
    }

    .slice {
      width: 85px;
    }
  }

  .toolbar {
    .indicator {
      &::before {
        content: " ";
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 6px;
        margin-right: 10px;
        position: relative;
        top: 1px;
      }

      &.z::before {
        background: #ef5350;
      }

      &.x::before {
        background: #fdd835;
      }

      &.y::before {
        background: #4caf50;
      }
    }
  }

  .viewer {
    flex: 1 1 0;
    position: relative;
    overflow-y: hidden;
    // display: flex;
    // flex-direction: column;
  }

  .viewer > div {
    // flex: 1 1 0;
    position: relative;
    overflow-y: hidden;
    cursor: crosshair!important;
  }
}

.crosshairs {
  z-index: 3;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>
