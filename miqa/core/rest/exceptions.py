import logging
import uuid

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    if response is None:
        exception_identifier = uuid.uuid4()
        logger.exception(f'Unexpected REST API error: {exception_identifier}')
        return Response(
            data={
                'detail': 'Unexpected server error. '
                f'Refer to error {exception_identifier} in the server logs.'
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    return response
