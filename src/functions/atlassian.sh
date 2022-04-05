function atlas-manager-service-graphql() {
  atlas slauth http --aud manager-service https://manager-service.us-west-2.prod.atl-paas.net/api/v2/graphql "$@"
}

function atlas-favorite-services() {
  atlas-manager-service-graphql 'query=query { favorites { services { id } } }' | jq --raw-output '.data.favorites.services[].id'
}
