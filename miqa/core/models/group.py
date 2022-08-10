from uuid import uuid4
from django.contrib.auth.models import User
from django.db import models


class Group(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    name = models.CharField(max_length=255, blank=False)
    description = models.TextField()
