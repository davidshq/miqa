FROM python:3.14-rc-slim-bookworm
# Install system libraries for Python packages:
# * psycopg2
RUN apt-get update && \
    apt-get install --no-install-recommends --yes \
        libpq-dev gcc libc6-dev && \
    apt-get install --no-install-recommends --yes \
    git && \
    rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Only copy the setup.py, it will still force all install_requires to be installed,
# but find_packages() will find nothing (which is fine). When Docker Compose mounts the real source
# over top of this directory, the .egg-link in site-packages resolves to the mounted directory
# and all package modules are importable.
COPY ./setup.py /opt/django-project/setup.py
RUN pip install --editable /opt/django-project[dev,zarr,learning]

# Copy the git folder so we can fetch the version tag at runtime
COPY ./.git /opt/django-project/.git

# Use a directory name which will never be an import name, as isort considers this as first-party.
WORKDIR /opt/django-project
