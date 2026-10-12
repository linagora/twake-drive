# Node of .nvmrc with the Docker CLI: the QA scripts build Drive and drive the compose stack of the
# e2e suite (e2e/setup/global-setup.ts) without depending on the Node and Yarn of the host.
FROM docker:27-cli AS docker

FROM node:24
COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
