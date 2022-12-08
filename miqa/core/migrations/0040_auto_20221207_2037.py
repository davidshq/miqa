# Generated by Django 3.2.16 on 2022-12-07 20:37

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0039_auto_20221207_2028'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='project',
            name='file_mapping_group',
        ),
        migrations.AddField(
            model_name='project',
            name='type_model_mapping_group',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='type_model_mapping_group', to='core.settingsgroup'),
        ),
    ]
