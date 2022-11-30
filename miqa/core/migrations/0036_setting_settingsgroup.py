# Generated by Django 3.2.16 on 2022-11-29 17:07

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0035_allow_null_decision_creation_times'),
    ]

    operations = [
        migrations.CreateModel(
            name='SettingsGroup',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
            ],
        ),
        migrations.CreateModel(
            name='Setting',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('key', models.CharField(max_length=255)),
                ('value', models.TextField(blank=True)),
                ('is_type', models.BooleanField(blank=True, default=False)),
                ('group', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='settings', to='core.settingsgroup')),
                ('type', models.ForeignKey(blank=True, limit_choices_to={'is_type': True}, null=True, on_delete=django.db.models.deletion.SET_NULL, to='core.setting')),
            ],
        ),
    ]