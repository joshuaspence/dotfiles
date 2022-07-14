function atlas-favorite-services() {
  read -r -d '' query <<-'EOT'
    query {
      favorites {
        services {
          id
        }
      }
    }
EOT
  atlas-manager-service-graphql "query=${query}" | jq --raw-output '.data.favorites.services[].id'
}

function atlas-manager-service-graphql() {
  atlas slauth http --aud manager-service https://manager-service.us-west-2.prod.atl-paas.net/api/v2/graphql "$@"
}

function atlas-service-descriptor() {
  atlas micros service show --output yaml --service "$1" | \
    env "MICROS_ENV=$2" "MICROS_DEPLOYMENT_ID=$3" \
    yq $'.stacks | map_values(map({"key": .deploymentId, "value": .originalSd}) | from_entries) | ([strenv(MICROS_ENV), strenv(MICROS_DEPLOYMENT_ID)] | map(select(. != "")) | .[]) as $item ireduce(.; .[$item])'
}

function atlas-service-domains() {
  read -r -d '' query <<-'EOT'
    query service($id: ID!) {
      service(id: $id) {
        id
        currentUserPermission
        attributes {
          dnsNamesAttribute {
            etag
            value {
              source
              type
              value
            }
          }
        }
      }
    }
EOT
  atlas-manager-service-graphql "query=${query}" "variables[id]=$1" | jq --raw-output '.data.service.attributes.dnsNamesAttribute.value[].value'
}

function atlas-service-proxy-config() {
  atlas-service-descriptor "$@" | yq '.serviceProxy'
}
