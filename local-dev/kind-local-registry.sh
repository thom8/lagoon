#!/bin/sh
set -o errexit

# create registry container unless it already exists
reg_name="${1}-local-registry"
reg_port='5000'
running="$(docker inspect -f '{{.State.Running}}' "${reg_name}" 2>/dev/null || true)"
if [ "${running}" != 'true' ]; then
  docker run \
    -d --restart=always -p "${reg_port}:5000" --name "${reg_name}" \
    registry:2
fi

# add the registry to /etc/hosts on each node
ip_fmt='{{.NetworkSettings.IPAddress}}'
cmd="echo $(docker inspect -f "${ip_fmt}" "${reg_name}") registry >> /etc/hosts"
for node in $(./local-dev/kind get nodes --name "${1}"); do
  docker exec "${node}" sh -c "${cmd}"
done
