// ATV World hosting: one resource group with a Standard Static Web App.
targetScope = 'subscription'

@description('Region for the resource group and the Static Web App.')
param location string = 'westus2'

@description('Resource group that holds everything.')
param resourceGroupName string = 'rg-atv-world'

@description('Static Web App name.')
param siteName string = 'swa-atv-world'

@description('Tags applied to every resource.')
param tags object = {
  project: 'atv-world'
  environment: 'nonprod'
  repo: 'All-The-Vibes/ATV-world'
}

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// GitHub Actions uploads the built site with the deployment token, so no repo link is needed here.
module site 'br/public:avm/res/web/static-site:0.9.6' = {
  name: 'static-site'
  scope: rg
  params: {
    name: siteName
    location: location
    sku: 'Standard'
    stagingEnvironmentPolicy: 'Disabled'
    allowConfigFileUpdates: true
    tags: tags
  }
}

output resourceGroupName string = rg.name
output siteName string = site.outputs.name
output url string = 'https://${site.outputs.defaultHostname}'
