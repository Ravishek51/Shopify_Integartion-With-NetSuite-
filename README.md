I hope you're doing well.

Our company had a requirement to integrate NetSuite with Shopify without utilizing any third-party applications, such as NetSuite connectors or Celigo. To meet this requirement, I successfully implemented the integration using NetSuite's native APIs.

Approach:
I achieved this by utilizing a UserEvent Script with the afterSubmit context. This script fetches the necessary details from a saved search, constructs the required payload, and sends the data to Shopify using the NetSuite https.post API.

This approach ensures seamless communication between the two platforms without relying on third-party solutions.

Thank you.
