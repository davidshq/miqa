# Generated by Django 3.2.16 on 2023-01-10 18:52

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0041_auto_20221208_1429'),
    ]

    operations = [
        migrations.AlterField(
            model_name='project',
            name='artifact_group',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='artifact_group', to='core.setting'),
        ),
        migrations.AlterField(
            model_name='project',
            name='model_mapping_group',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='model_mapping_group', to='core.setting'),
        ),
        migrations.AlterField(
            model_name='project',
            name='model_predictions_group',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='model_predictions_group', to='core.setting'),
        ),
        migrations.AlterField(
            model_name='project',
            name='model_source_type_mapping_group',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='model_source_type_mapping_group', to='core.setting'),
        ),
        migrations.AlterField(
            model_name='setting',
            name='group',
            field=models.ForeignKey(blank=True, limit_choices_to={'type__key__exact': 'Group'}, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='setting_group', to='core.setting'),
        ),
        migrations.AlterField(
            model_name='setting',
            name='type',
            field=models.ForeignKey(blank=True, limit_choices_to={'is_type': True}, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='setting_type', to='core.setting'),
        ),
    ]
