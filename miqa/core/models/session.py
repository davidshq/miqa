from django.contrib.auth.models import User
from django.db import models
from django_extensions.db.models import TimeStampedModel


class Session(TimeStampedModel, models.Model):
    name = models.CharField(max_length=255)
    creator = models.ForeignKey(User, on_delete=models.PROTECT)
