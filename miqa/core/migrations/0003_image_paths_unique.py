# Generated by Django 3.2 on 2021-05-12 13:16

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0002_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='image',
            name='raw_path',
            field=models.CharField(max_length=500, unique=True),
        ),
    ]
