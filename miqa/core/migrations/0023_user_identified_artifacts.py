# Generated by Django 3.2.9 on 2021-12-02 19:48

from django.db import migrations, models

import miqa.core.models.scan_decision


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0022_project_global_import_export'),
    ]

    operations = [
        migrations.AddField(
            model_name='scandecision',
            name='user_identified_artifacts',
            field=models.JSONField(
                default=dict
            ),
        ),
    ]
