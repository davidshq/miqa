from uuid import uuid4

from django.contrib.auth.models import User
from django.db import models
from django_extensions.db.models import TimeStampedModel


class Experiment(TimeStampedModel, models.Model):
    class Meta:
        indexes = [models.Index(fields=['project', 'name'])]
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'name'], name='experiment_project_name_unique'
            ),
        ]
        ordering = ['name']

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    name = models.CharField(max_length=255, blank=False)
    note = models.TextField(max_length=3000, blank=True)
    project = models.ForeignKey('Project', related_name='experiments', on_delete=models.CASCADE)

    lock_time = models.DateTimeField(null=True)
    lock_owner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        default=None,
        related_name='experiment_locks',
    )

    def __str__(self):
        return self.name
