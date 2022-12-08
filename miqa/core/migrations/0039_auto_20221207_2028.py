# Generated by Django 3.2.16 on 2022-12-07 20:28

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0038_project_model_mapping_group'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='file_mapping_group',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='file_mapping_group', to='core.settingsgroup'),
        ),
        migrations.AddField(
            model_name='project',
            name='model_predictions_group',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='model_predictions_group', to='core.settingsgroup'),
        ),
    ]
