# The image of the application: cozy-stack (COZY_STACK_IMAGE, see build.sh) with the build of Drive of the commit under
# test in /opt/drive, which start.sh installs in the instances (cozy-stack apps install drive file:///opt/drive).
# Built with the build/ folder of the checkout as context.
ARG COZY_STACK_IMAGE=cozy/cozy-stack:latest
FROM ${COZY_STACK_IMAGE}
COPY . /opt/drive
