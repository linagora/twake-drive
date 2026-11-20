#!/bin/bash
# A node of the Redis Sentinel set: a redis-server (6379) and a redis-sentinel (26379), both announced by host name so
# that a restart keeps the topology. First start of the set: redis1 is the master, redis2 and redis3 its replicas. A node
# that starts again asks the sentinels of the others for the current master and joins it as a replica: a former master
# never comes back as a second one. Either process exits: the node exits.
me="$(hostname)"

master=""
for peer in redis1 redis2 redis3; do
  [ "$peer" = "$me" ] && continue
  master="$(timeout 2 redis-cli -h "$peer" -p 26379 --raw sentinel get-master-addr-by-name chaos 2>/dev/null | head -1)"
  [ -n "$master" ] && break
done
[ -n "$master" ] || master=redis1

replicaof=()
[ "$master" != "$me" ] && replicaof=(--replicaof "$master" 6379)

# min-replicas-to-write 1: a master cut from both its replicas refuses the writes it would lose at the next failover
redis-server --port 6379 --protected-mode no --replica-announce-ip "$me" \
  --appendonly yes --appenddirname aof --save "" --maxmemory 96mb --maxmemory-policy noeviction \
  --min-replicas-to-write 1 --min-replicas-max-lag 10 "${replicaof[@]}" &

# the sentinel rewrites its configuration (the current master, the other sentinels): written once, kept on restart
if [ ! -s /data/sentinel.conf ]; then
  cat > /data/sentinel.conf <<EOF
port 26379
protected-mode no
dir /data
sentinel resolve-hostnames yes
sentinel announce-hostnames yes
sentinel announce-ip $me
sentinel monitor chaos $master 6379 2
sentinel down-after-milliseconds chaos 5000
sentinel failover-timeout chaos 20000
sentinel parallel-syncs chaos 1
EOF
fi
redis-sentinel /data/sentinel.conf &

wait -n
exit 1
