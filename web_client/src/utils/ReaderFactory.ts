type ReadAsArrayBufferOptions = Partial<{
  onDownloadProgress: () => void;
}>

type ReaderConfig = {
  name: string,
  vtkReader: any,
  readMethod: 'readAsArrayBuffer' | 'readAsText',
  parseMethod: 'parseAsArrayBuffer' | 'parseAsText',
  fileNameMethod?: string,
  fileSeriesMethod?: string,
  sourceType: any,
}

export type ReaderFactoryConfig = {
  extension: string
  name: string
  vtkReader: any
  readMethod?: "readAsArrayBuffer" | "readAsText"
  parseMethod?: "parseAsArrayBuffer" | "parseAsText"
  fileNameMethod: string | null | undefined
  fileSeriesMethod?: string | null | undefined
  sourceType?: any
  binary: boolean
}

const READER_MAPPING:Record<string, ReaderConfig> = {};

const FETCH_DATA = {
  readAsArrayBuffer(axios, url, signal, { onDownloadProgress }: ReadAsArrayBufferOptions = {}) {
    console.log('ReaderFactory - FETCH_DATA - readAsArrayBuffer: Running');
    return axios
      .get(url, {
        responseType: 'arraybuffer',
        signal,
        onDownloadProgress,
      })
      .then(({ data }) => data);
  },
};

function registerReader({
  extension,
  name,
  vtkReader,
  readMethod,
  parseMethod,
  fileNameMethod,
  fileSeriesMethod,
  sourceType,
  binary,
}: ReaderFactoryConfig) {
  console.log('ReaderFactory - registerReader: Running');
  READER_MAPPING[extension] = {
    name,
    vtkReader,
    readMethod: readMethod || binary ? 'readAsArrayBuffer' : 'readAsText',
    parseMethod: parseMethod || binary ? 'parseAsArrayBuffer' : 'parseAsText',
    fileNameMethod,
    fileSeriesMethod,
    sourceType,
  };
}

/**
 * Gets the correct reader for the given file name
 *
 * @param fileName
 * @returns {*}
 */
function getReader({ fileName }) {
  console.log('ReaderFactory - getReader: Running');
  const lowerCaseName = fileName.toLowerCase();
  const extToUse = Object.keys(READER_MAPPING).find((ext) => lowerCaseName.endsWith(ext));
  return READER_MAPPING[extToUse];
}

/**
 * Downloads file represent Frame.
 *
 * Used by Vuex store
 *
 * @param axios               The client
 * @param fileName            File to be downloaded
 * @param url                 The URL to download the file
 * @param onDownloadProgress  downloadLoaded and downloadTotal, see Scan.vue
 * @returns {{promise: Promise<unknown>, abortController: AbortController}}
 */
function downloadFrame(axios, fileName, url, { onDownloadProgress }: ReadAsArrayBufferOptions = {}) {
  console.log('ReaderFactory - downloadFrame: Running');
  const abortController = new AbortController();

  return {
    promise: new Promise((resolve, reject) => {
      const readerMapping = getReader({ fileName });
      if (readerMapping) {
        const { readMethod } = readerMapping;
        FETCH_DATA[readMethod](axios, url, abortController.signal, { onDownloadProgress })
          .then((rawData) => {
            if (rawData) {
              // Return the file
              resolve(new File([rawData], fileName));
            } else {
              throw new Error(`No data for ${fileName}`);
            }
          })
          .catch(reject);
      } else {
        throw new Error(`No reader found for ${fileName}`);
      }
    }),
    abortController,
  };
}

export default {
  downloadFrame,
  registerReader,
};
