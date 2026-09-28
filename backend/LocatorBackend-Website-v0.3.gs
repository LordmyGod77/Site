/**
 * APARTMENT PROS LOCATOR BACKEND
 *
 * Standalone Apps Script web app.
 *
 * Apartment database policy:
 *   READ: Communities, Floorplans, availability and optional descriptive data.
 *   WRITE: ONLY community email fields + map coordinate fields.
 *
 * Operations spreadsheet:
 *   WRITE: guest-card logs, tour logs, sent-email logs.
 *
 * Client conversations are NOT stored by this backend.
 */

/* ============================================================
 * INSTALLATION / SCRIPT PROPERTIES
 * ========================================================== */

const LOCATOR_PROPERTIES = {
  APARTMENT_DB_ID: "LOCATOR_APARTMENT_DB_SPREADSHEET_ID",
  OPERATIONS_ID: "LOCATOR_OPERATIONS_SPREADSHEET_ID",
  API_KEY: "LOCATOR_API_KEY",

  GMAIL_OAUTH_CLIENT_ID: "LOCATOR_GMAIL_OAUTH_CLIENT_ID",
  GMAIL_OAUTH_CLIENT_SECRET: "LOCATOR_GMAIL_OAUTH_CLIENT_SECRET",
  GMAIL_OAUTH_REDIRECT_URI: "LOCATOR_GMAIL_OAUTH_REDIRECT_URI",
  GMAIL_OAUTH_REFRESH_TOKEN: "LOCATOR_GMAIL_OAUTH_REFRESH_TOKEN",
  GMAIL_OAUTH_ACCESS_TOKEN: "LOCATOR_GMAIL_OAUTH_ACCESS_TOKEN",
  GMAIL_OAUTH_ACCESS_EXPIRES_AT: "LOCATOR_GMAIL_OAUTH_ACCESS_EXPIRES_AT",
  GMAIL_OAUTH_AUTHORIZED_EMAIL: "LOCATOR_GMAIL_OAUTH_AUTHORIZED_EMAIL",
  GMAIL_OAUTH_STATE: "LOCATOR_GMAIL_OAUTH_STATE",
  GMAIL_OAUTH_STATE_EXPIRES_AT: "LOCATOR_GMAIL_OAUTH_STATE_EXPIRES_AT",
  HUD_API_TOKEN: "LOCATOR_HUD_API_TOKEN",
  TWILIO_ACCOUNT_SID: "LOCATOR_TWILIO_ACCOUNT_SID",
  TWILIO_AUTH_TOKEN: "LOCATOR_TWILIO_AUTH_TOKEN",
  TWILIO_FROM_NUMBER: "LOCATOR_TWILIO_FROM_NUMBER"
};

const LOCATOR_SHEETS = {
  COMMUNITIES: "Communities",
  FLOORPLANS: "Floorplans",
  GUEST_CARDS: "GuestCardLog",
  TOURS: "TourLog",
  EMAIL_LOG: "EmailSentLog",
  WEBSITE_LEADS: "WebsiteLeadLog",
  APPLICATION_FOLLOWUP: "ApplicationFollowUp",
  PROPERTY_SUPPORT: "PropertySupport",
  MESSAGE_CONTACTS: "MessageContacts",
  MESSAGE_LOG: "MessageLog"
};

const LOCATOR_ALLOWED_COMMUNITY_WRITE_COLUMNS = [
  "GuestCardEmail",
  "TourEmail",
  "EmailNotes",
  "EmailUpdatedAt",
  "Latitude",
  "Longitude",
  "CoordinatesUpdatedAt"
];


/*
 * Fixed Locator email identity.
 *
 * The Apps Script can remain owned by your private tech Google
 * account. Email sending is allowed only as this address.
 */
const LOCATOR_MAIL_IDENTITY = {
  sendAs:
    "Avrey@apartment-pros.com",

  replyTo:
    "Avrey@apartment-pros.com",

  displayName:
    "Avrey Anderson | Apartment Pros"
};

/**
 * Run this ONCE from the Apps Script editor.
 *
 * Example:
 *
 * locatorInstall(
 *   "YOUR_APARTMENT_DATABASE_SPREADSHEET_ID",
 *   "choose-a-long-random-api-key"
 * );
 *
 * This creates a completely separate Operations spreadsheet.
 */
function locatorInstall(
  apartmentDatabaseSpreadsheetId,
  apiKey
) {
  const apartmentId =
    String(
      apartmentDatabaseSpreadsheetId || ""
    ).trim();

  const key =
    String(
      apiKey || ""
    ).trim();

  if (!apartmentId) {
    throw new Error(
      "Apartment database spreadsheet ID is required."
    );
  }

  if (key.length < 16) {
    throw new Error(
      "Choose an API key at least 16 characters long."
    );
  }

  const apartmentDb =
    SpreadsheetApp.openById(
      apartmentId
    );

  const operations =
    SpreadsheetApp.create(
      "Apartment Pros - Locator Operations"
    );

  const properties =
    PropertiesService
      .getScriptProperties();

  properties.setProperties({
    [LOCATOR_PROPERTIES.APARTMENT_DB_ID]:
      apartmentDb.getId(),

    [LOCATOR_PROPERTIES.OPERATIONS_ID]:
      operations.getId(),

    [LOCATOR_PROPERTIES.API_KEY]:
      key
  });

  locatorEnsureApartmentWritableColumns_();
  locatorSetupOperationsSheets_();

  return {
    apartmentDatabaseSpreadsheetId:
      apartmentDb.getId(),

    apartmentDatabaseName:
      apartmentDb.getName(),

    operationsSpreadsheetId:
      operations.getId(),

    operationsSpreadsheetName:
      operations.getName(),

    operationsSpreadsheetUrl:
      operations.getUrl()
  };
}


/* ============================================================
 * WEB APP
 * ========================================================== */

function doGet(e) {
  const parameters = e && e.parameter ? e.parameter : {};

  if (parameters.code || parameters.error) {
    try {
      const result = locatorHandleGmailOAuthCallback_(parameters);
      return HtmlService.createHtmlOutput(
        "<html><body style='font-family:Arial,sans-serif;padding:30px'>" +
        "<h2>Locator Gmail connected</h2>" +
        "<p>Authorized mailbox: <strong>" + locatorEscapeHtml_(result.authorizedEmail) + "</strong></p>" +
        "<p>You can close this tab and return to Locator Assistant.</p></body></html>"
      );
    }
    catch (error) {
      return HtmlService.createHtmlOutput(
        "<html><body style='font-family:Arial,sans-serif;padding:30px'><h2>Locator Gmail authorization failed</h2><p>" +
        locatorEscapeHtml_(error.message || String(error)) + "</p></body></html>"
      );
    }
  }

  if (String(parameters.admin || "").trim().toLowerCase() === "mobile") {
    return HtmlService.createHtmlOutputFromFile("LocatorAdmin")
      .setTitle("Apartment Pros Admin")
      .addMetaTag("viewport", "width=device-width, initial-scale=1, viewport-fit=cover");
  }

  const action = String(parameters.action || "").trim();
  if (locatorIsPublicReadAction_(action)) {
    try {
      const request = locatorPublicRequestFromGet_(parameters);
      const data = locatorDispatchPublicAction_(action, request);
      return locatorPublicOutput_({ success: true, data: data }, parameters.callback || parameters.prefix || "");
    }
    catch (error) {
      return locatorPublicOutput_({ success: false, error: error.message || String(error) }, parameters.callback || parameters.prefix || "");
    }
  }

  return locatorJson_({ success: true, data: { service: "Apartment Pros Locator Backend", status: "ok" } });
}

function doPost(e) {
  try {
    const request =
      locatorParseRequest_(
        e
      );

    const action =
      String(
        request.action || ""
      ).trim();

    let data;

    if (locatorIsPublicPostAction_(action)) {
      data = locatorDispatchPublicAction_(action, request);
      return locatorJson_({ success: true, data: data });
    }

    locatorRequireApiKey_(
      request.apiKey
    );

    switch (action) {

      case "health":
        data =
          locatorHealth_();
        break;

      case "locatorSearchApartments":
        data =
          locatorSearchApartments_(
            request.criteria || {}
          );
        break;

      case "locatorGetFloorplan":
        data =
          locatorGetFloorplan_(
            request.floorplanId
          );
        break;

      case "locatorGetCommunity":
        data =
          locatorGetCommunity_(
            request.communityId
          );
        break;

      case "locatorGetCommunityContact":
        data =
          locatorGetCommunityContact_(
            request.communityId
          );
        break;

      case "locatorListCommunities":
        data =
          locatorListCommunities_();
        break;

      case "locatorListFloorplansByCommunity":
        data =
          locatorListFloorplansByCommunity_(
            request.communityId
          );
        break;

      case "locatorGetSenderAliases":
      case "locatorGetMailIdentity":
      case "locatorGetGmailOAuthStatus":
        data =
          locatorGetGmailOAuthStatus_();
        break;

      case "locatorGetGmailOAuthAuthorizationUrl":
        data =
          locatorGetGmailOAuthAuthorizationUrl_();
        break;

      case "locatorDisconnectGmailOAuth":
        data =
          locatorDisconnectGmailOAuth_();
        break;

      /*
       * EXPLICIT APARTMENT-DATABASE WRITE #1:
       * community email fields only.
       */
      case "locatorSetCommunityEmails":
        data =
          locatorSetCommunityEmails_(
            request
          );
        break;

      /*
       * EXPLICIT APARTMENT-DATABASE WRITE #2:
       * map coordinates only.
       */
      case "locatorSetCommunityCoordinates":
        data =
          locatorSetCommunityCoordinates_(
            request
          );
        break;

      case "locatorGeocodeCommunity":
        data =
          locatorGeocodeCommunity_(
            request.communityId
          );
        break;

      case "locatorGeocodeLocation":
        data =
          locatorGeocodeLocation_(
            request.query
          );
        break;

      /*
       * Operations spreadsheet only.
       */
      case "locatorSendGuestCard":
        data =
          locatorSendGuestCard_(
            request.guestCard || {}
          );
        break;

      case "locatorLogTour":
        data =
          locatorLogTour_(
            request.tour || {}
          );
        break;

      case "locatorSendTourRequests":
        data =
          locatorSendTourRequests_(
            request
          );
        break;

      case "locatorLogEmailSent":
        data =
          locatorLogEmailSent_(
            request.email || {}
          );
        break;

      case "locatorListApplicationFollowUps":
        data = locatorListApplicationFollowUps_();
        break;

      case "locatorUpsertApplicationFollowUp":
        data = locatorUpsertApplicationFollowUp_(request.followUp || {});
        break;

      case "locatorListMessageContacts":
        data = locatorListMessageContacts_();
        break;

      case "locatorUpsertMessageContact":
        data = locatorUpsertMessageContact_(request.contact || {});
        break;

      case "locatorSendSmsBatch":
        data = locatorSendSmsBatch_(request);
        break;

      default:
        throw new Error(
          "Unknown Locator action: " +
          action
        );
    }

    return locatorJson_({
      success: true,
      data
    });
  }
  catch (error) {
    console.error(
      error &&
      error.stack
        ? error.stack
        : error
    );

    return locatorJson_({
      success: false,
      error:
        error.message ||
        String(error)
    });
  }
}


/* ============================================================
 * HEALTH
 * ========================================================== */

function locatorHealth_() {
  const apartmentDb =
    locatorApartmentDb_();

  const operations =
    locatorOperationsDb_();

  return {
    apartmentDatabaseName:
      apartmentDb.getName(),

    operationsSpreadsheetName:
      operations.getName()
  };
}


function locatorListCommunities_() {
  return {
    communities:
      locatorReadCommunities_()
        .map(
          item => ({
            communityId:
              item.communityId,

            communityName:
              item.communityName,

            address:
              item.address,

            city:
              item.city,

            state:
              item.state,

            zip:
              item.zip,

            communityUrl:
              item.url,

            guestCardEmail:
              item.guestCardEmail,

            tourEmail:
              item.tourEmail,

            latitude:
              item.latitude,

            longitude:
              item.longitude
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            String(
              a.communityUrl ||
              ""
            ).localeCompare(
              String(
                b.communityUrl ||
                ""
              )
            )
        )
  };
}


function locatorListFloorplansByCommunity_(communityId) {
  const wanted = String(communityId || "").trim();

  if (!wanted) {
    throw new Error("CommunityID is required.");
  }

  const floorplans = locatorReadFloorplans_()
    .filter(item => item.communityId === wanted)
    .map(item => ({
      floorplanId: item.floorplanId,
      communityId: item.communityId,
      floorplanName: item.floorplanName,
      name: item.floorplanName,
      beds: item.beds,
      baths: item.baths,
      sqft: item.sqft,
      availabilityCount: Array.isArray(item.availability) ? item.availability.length : 0,
      specialText: item.specialText
    }))
    .sort((a, b) =>
      String(a.floorplanName || "").localeCompare(String(b.floorplanName || ""))
    );

  return {
    communityId: wanted,
    floorplans
  };
}


function locatorConfigureGmailOAuth(
  clientId,
  clientSecret,
  redirectUri
) {
  const id =
    String(
      clientId ||
      ""
    ).trim();

  const secret =
    String(
      clientSecret ||
      ""
    ).trim();

  const redirect =
    String(
      redirectUri ||
      ""
    ).trim();

  if (!id) {
    throw new Error(
      "Google OAuth client ID is required."
    );
  }

  if (!secret) {
    throw new Error(
      "Google OAuth client secret is required."
    );
  }

  if (
    !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(
      redirect
    )
  ) {
    throw new Error(
      "redirectUri must be this Locator Apps Script Web App's exact /exec URL."
    );
  }

  const properties =
    PropertiesService
      .getScriptProperties();

  properties.setProperties({
    [LOCATOR_PROPERTIES.GMAIL_OAUTH_CLIENT_ID]:
      id,

    [LOCATOR_PROPERTIES.GMAIL_OAUTH_CLIENT_SECRET]:
      secret,

    [LOCATOR_PROPERTIES.GMAIL_OAUTH_REDIRECT_URI]:
      redirect
  });

  /*
   * A new client configuration intentionally invalidates any
   * previously stored mailbox grant.
   */
  locatorClearGmailOAuthTokens_();

  const authorization =
    locatorGetGmailOAuthAuthorizationUrl_();

  return {
    configured:
      true,

    redirectUri:
      redirect,

    requiredEmail:
      LOCATOR_MAIL_IDENTITY.sendAs,

    authorizationUrl:
      authorization.authorizationUrl
  };
}


function locatorGetGmailOAuthStatus_() {
  const properties =
    PropertiesService
      .getScriptProperties();

  const clientId =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_CLIENT_ID
      ) ||
      ""
    ).trim();

  const redirectUri =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_REDIRECT_URI
      ) ||
      ""
    ).trim();

  const refreshToken =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_REFRESH_TOKEN
      ) ||
      ""
    ).trim();

  const authorizedEmail =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_AUTHORIZED_EMAIL
      ) ||
      ""
    ).trim();

  return {
    requiredEmail:
      LOCATOR_MAIL_IDENTITY.sendAs,

    replyTo:
      LOCATOR_MAIL_IDENTITY.replyTo,

    displayName:
      LOCATOR_MAIL_IDENTITY.displayName,

    oauthConfigured:
      Boolean(
        clientId &&
        redirectUri
      ),

    connected:
      Boolean(
        refreshToken &&
        authorizedEmail &&
        authorizedEmail.toLowerCase() ===
          LOCATOR_MAIL_IDENTITY.sendAs.toLowerCase()
      ),

    authorizedEmail:
      authorizedEmail,

    redirectUri:
      redirectUri
  };
}


function locatorGetGmailOAuthAuthorizationUrl_() {
  const properties =
    PropertiesService
      .getScriptProperties();

  const clientId =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_CLIENT_ID
      ) ||
      ""
    ).trim();

  const clientSecret =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_CLIENT_SECRET
      ) ||
      ""
    ).trim();

  const redirectUri =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_REDIRECT_URI
      ) ||
      ""
    ).trim();

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri
  ) {
    throw new Error(
      "Gmail OAuth is not configured yet. Run locatorConfigureGmailOAuth(clientId, clientSecret, webAppExecUrl) from the Apps Script editor first."
    );
  }

  const state =
    Utilities.getUuid() +
    Utilities.getUuid();

  properties.setProperties({
    [LOCATOR_PROPERTIES.GMAIL_OAUTH_STATE]:
      state,

    [LOCATOR_PROPERTIES.GMAIL_OAUTH_STATE_EXPIRES_AT]:
      String(
        Date.now() +
        10 * 60 * 1000
      )
  });

  const scopes = [
    "openid",
    "email",
    "https://www.googleapis.com/auth/gmail.send"
  ];

  const parameters = {
    client_id:
      clientId,

    redirect_uri:
      redirectUri,

    response_type:
      "code",

    scope:
      scopes.join(
        " "
      ),

    access_type:
      "offline",

    include_granted_scopes:
      "true",

    prompt:
      "consent select_account",

    state:
      state,

    login_hint:
      LOCATOR_MAIL_IDENTITY.sendAs
  };

  const query =
    Object.keys(
      parameters
    )
      .map(
        key =>
          encodeURIComponent(
            key
          ) +
          "=" +
          encodeURIComponent(
            parameters[
              key
            ]
          )
      )
      .join(
        "&"
      );

  return {
    authorizationUrl:
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      query,

    redirectUri,

    requiredEmail:
      LOCATOR_MAIL_IDENTITY.sendAs
  };
}


function locatorHandleGmailOAuthCallback_(
  parameters
) {
  parameters =
    parameters ||
    {};

  if (
    parameters.error
  ) {
    throw new Error(
      "Google OAuth returned: " +
      parameters.error +
      (
        parameters.error_description
          ? " - " +
            parameters.error_description
          : ""
      )
    );
  }

  const code =
    String(
      parameters.code ||
      ""
    ).trim();

  const state =
    String(
      parameters.state ||
      ""
    ).trim();

  if (!code) {
    throw new Error(
      "Google OAuth callback did not contain an authorization code."
    );
  }

  const properties =
    PropertiesService
      .getScriptProperties();

  const expectedState =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_STATE
      ) ||
      ""
    );

  const stateExpiresAt =
    Number(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_STATE_EXPIRES_AT
      ) ||
      0
    );

  properties.deleteProperty(
    LOCATOR_PROPERTIES.GMAIL_OAUTH_STATE
  );

  properties.deleteProperty(
    LOCATOR_PROPERTIES.GMAIL_OAUTH_STATE_EXPIRES_AT
  );

  if (
    !expectedState ||
    state !==
      expectedState ||
    !stateExpiresAt ||
    Date.now() >
      stateExpiresAt
  ) {
    throw new Error(
      "OAuth state check failed or expired. Start the Gmail connection again from Locator Assistant."
    );
  }

  const clientId =
    properties.getProperty(
      LOCATOR_PROPERTIES.GMAIL_OAUTH_CLIENT_ID
    );

  const clientSecret =
    properties.getProperty(
      LOCATOR_PROPERTIES.GMAIL_OAUTH_CLIENT_SECRET
    );

  const redirectUri =
    properties.getProperty(
      LOCATOR_PROPERTIES.GMAIL_OAUTH_REDIRECT_URI
    );

  const tokenResponse =
    UrlFetchApp.fetch(
      "https://oauth2.googleapis.com/token",
      {
        method:
          "post",

        payload: {
          code,
          client_id:
            clientId,
          client_secret:
            clientSecret,
          redirect_uri:
            redirectUri,
          grant_type:
            "authorization_code"
        },

        muteHttpExceptions:
          true
      }
    );

  const statusCode =
    tokenResponse.getResponseCode();

  const responseText =
    tokenResponse.getContentText();

  let tokenData =
    {};

  try {
    tokenData =
      JSON.parse(
        responseText
      );
  }
  catch {
    tokenData =
      {};
  }

  if (
    statusCode <
      200 ||
    statusCode >=
      300 ||
    !tokenData.access_token
  ) {
    throw new Error(
      "Google token exchange failed (HTTP " +
      statusCode +
      "): " +
      responseText
    );
  }

  const userInfoResponse =
    UrlFetchApp.fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        method:
          "get",

        headers: {
          Authorization:
            "Bearer " +
            tokenData.access_token
        },

        muteHttpExceptions:
          true
      }
    );

  const userInfoCode =
    userInfoResponse.getResponseCode();

  const userInfoText =
    userInfoResponse.getContentText();

  let userInfo =
    {};

  try {
    userInfo =
      JSON.parse(
        userInfoText
      );
  }
  catch {
    userInfo =
      {};
  }

  const email =
    String(
      userInfo.email ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    userInfoCode <
      200 ||
    userInfoCode >=
      300 ||
    !email
  ) {
    throw new Error(
      "Could not verify the Google account authorized for Gmail sending."
    );
  }

  const requiredEmail =
    LOCATOR_MAIL_IDENTITY.sendAs
      .toLowerCase();

  if (
    email !==
    requiredEmail
  ) {
    locatorClearGmailOAuthTokens_();

    throw new Error(
      "Wrong Google account authorized. Locator requires " +
      LOCATOR_MAIL_IDENTITY.sendAs +
      ", but Google authorized " +
      email +
      ". Start the connection again and select the Avrey mailbox."
    );
  }

  const refreshToken =
    String(
      tokenData.refresh_token ||
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_REFRESH_TOKEN
      ) ||
      ""
    ).trim();

  if (!refreshToken) {
    throw new Error(
      "Google did not return a refresh token. Reconnect and grant consent again."
    );
  }

  const expiresIn =
    Number(
      tokenData.expires_in ||
      3600
    );

  properties.setProperties({
    [LOCATOR_PROPERTIES.GMAIL_OAUTH_REFRESH_TOKEN]:
      refreshToken,

    [LOCATOR_PROPERTIES.GMAIL_OAUTH_ACCESS_TOKEN]:
      String(
        tokenData.access_token
      ),

    [LOCATOR_PROPERTIES.GMAIL_OAUTH_ACCESS_EXPIRES_AT]:
      String(
        Date.now() +
        Math.max(
          60,
          expiresIn -
            60
        ) *
        1000
      ),

    [LOCATOR_PROPERTIES.GMAIL_OAUTH_AUTHORIZED_EMAIL]:
      email
  });

  return {
    connected:
      true,

    authorizedEmail:
      email
  };
}


function locatorDisconnectGmailOAuth_() {
  locatorClearGmailOAuthTokens_();

  return {
    connected:
      false,

    requiredEmail:
      LOCATOR_MAIL_IDENTITY.sendAs
  };
}


function locatorClearGmailOAuthTokens_() {
  const properties =
    PropertiesService
      .getScriptProperties();

  [
    LOCATOR_PROPERTIES.GMAIL_OAUTH_REFRESH_TOKEN,
    LOCATOR_PROPERTIES.GMAIL_OAUTH_ACCESS_TOKEN,
    LOCATOR_PROPERTIES.GMAIL_OAUTH_ACCESS_EXPIRES_AT,
    LOCATOR_PROPERTIES.GMAIL_OAUTH_AUTHORIZED_EMAIL,
    LOCATOR_PROPERTIES.GMAIL_OAUTH_STATE,
    LOCATOR_PROPERTIES.GMAIL_OAUTH_STATE_EXPIRES_AT
  ]
    .forEach(
      key =>
        properties.deleteProperty(
          key
        )
    );
}


function locatorGetGmailAccessToken_(
  forceRefresh
) {
  const properties =
    PropertiesService
      .getScriptProperties();

  const authorizedEmail =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_AUTHORIZED_EMAIL
      ) ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    authorizedEmail !==
    LOCATOR_MAIL_IDENTITY.sendAs.toLowerCase()
  ) {
    throw new Error(
      "Gmail OAuth is not connected to " +
      LOCATOR_MAIL_IDENTITY.sendAs +
      ". Open Locator Settings and connect Gmail OAuth first."
    );
  }

  const cachedAccessToken =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_ACCESS_TOKEN
      ) ||
      ""
    );

  const expiresAt =
    Number(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_ACCESS_EXPIRES_AT
      ) ||
      0
    );

  if (
    !forceRefresh &&
    cachedAccessToken &&
    expiresAt >
      Date.now() +
      30 * 1000
  ) {
    return cachedAccessToken;
  }

  const refreshToken =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_REFRESH_TOKEN
      ) ||
      ""
    ).trim();

  const clientId =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_CLIENT_ID
      ) ||
      ""
    ).trim();

  const clientSecret =
    String(
      properties.getProperty(
        LOCATOR_PROPERTIES.GMAIL_OAUTH_CLIENT_SECRET
      ) ||
      ""
    ).trim();

  if (
    !refreshToken ||
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Gmail OAuth is not fully configured."
    );
  }

  const refreshResponse =
    UrlFetchApp.fetch(
      "https://oauth2.googleapis.com/token",
      {
        method:
          "post",

        payload: {
          client_id:
            clientId,
          client_secret:
            clientSecret,
          refresh_token:
            refreshToken,
          grant_type:
            "refresh_token"
        },

        muteHttpExceptions:
          true
      }
    );

  const statusCode =
    refreshResponse.getResponseCode();

  const responseText =
    refreshResponse.getContentText();

  let data =
    {};

  try {
    data =
      JSON.parse(
        responseText
      );
  }
  catch {
    data =
      {};
  }

  if (
    statusCode <
      200 ||
    statusCode >=
      300 ||
    !data.access_token
  ) {
    if (
      data.error ===
      "invalid_grant"
    ) {
      locatorClearGmailOAuthTokens_();
    }

    throw new Error(
      "Could not refresh Gmail OAuth access (HTTP " +
      statusCode +
      "): " +
      responseText
    );
  }

  const expiresIn =
    Number(
      data.expires_in ||
      3600
    );

  properties.setProperties({
    [LOCATOR_PROPERTIES.GMAIL_OAUTH_ACCESS_TOKEN]:
      String(
        data.access_token
      ),

    [LOCATOR_PROPERTIES.GMAIL_OAUTH_ACCESS_EXPIRES_AT]:
      String(
        Date.now() +
        Math.max(
          60,
          expiresIn -
            60
        ) *
        1000
      )
  });

  return String(
    data.access_token
  );
}


function locatorSendGmailRaw_(
  rawMessage
) {
  const send =
    accessToken =>
      UrlFetchApp.fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method:
            "post",

          contentType:
            "application/json",

          headers: {
            Authorization:
              "Bearer " +
              accessToken
          },

          payload:
            JSON.stringify({
              raw:
                locatorBase64WebSafe_(
                  rawMessage
                )
            }),

          muteHttpExceptions:
            true
        }
      );

  let token =
    locatorGetGmailAccessToken_(
      false
    );

  let response =
    send(
      token
    );

  if (
    response.getResponseCode() ===
    401
  ) {
    token =
      locatorGetGmailAccessToken_(
        true
      );

    response =
      send(
        token
      );
  }

  const code =
    response.getResponseCode();

  const body =
    response.getContentText();

  if (
    code <
      200 ||
    code >=
      300
  ) {
    throw new Error(
      "Gmail API send failed (HTTP " +
      code +
      "): " +
      body
    );
  }

  try {
    return JSON.parse(
      body
    );
  }
  catch {
    return {
      rawResponse:
        body
    };
  }
}


function locatorBuildPlainTextMime_(
  to,
  bcc,
  subject,
  body
) {
  const headers = [
    "From: " +
      locatorMailAddressHeader_(
        LOCATOR_MAIL_IDENTITY.displayName,
        LOCATOR_MAIL_IDENTITY.sendAs
      ),
    "Reply-To: " +
      LOCATOR_MAIL_IDENTITY.replyTo,
    "To: " +
      String(
        to ||
        ""
      ),
    bcc
      ? "Bcc: " +
        String(
          bcc
        )
      : "",
    "Subject: " +
      locatorMimeHeader_(
        subject
      ),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    locatorWrapBase64_(
      Utilities.base64Encode(
        String(
          body ||
          ""
        ),
        Utilities.Charset.UTF_8
      )
    )
  ]
    .filter(
      value =>
        value !==
        ""
    );

  /* Re-insert the mandatory blank separator before body. */
  const contentTransferIndex =
    headers.indexOf(
      "Content-Transfer-Encoding: base64"
    );

  headers.splice(
    contentTransferIndex +
      1,
    0,
    ""
  );

  return headers.join(
    "\r\n"
  );
}


function locatorBuildPdfMime_(
  to,
  bcc,
  subject,
  body,
  pdfBlob
) {
  const boundary =
    "locator_" +
    Utilities.getUuid()
      .replace(
        /-/g,
        ""
      );

  const filename =
    String(
      pdfBlob.getName() ||
      "Guest Card.pdf"
    );

  const bodyBase64 =
    locatorWrapBase64_(
      Utilities.base64Encode(
        String(
          body ||
          ""
        ),
        Utilities.Charset.UTF_8
      )
    );

  const pdfBase64 =
    locatorWrapBase64_(
      Utilities.base64Encode(
        pdfBlob.getBytes()
      )
    );

  const lines = [
    "From: " +
      locatorMailAddressHeader_(
        LOCATOR_MAIL_IDENTITY.displayName,
        LOCATOR_MAIL_IDENTITY.sendAs
      ),
    "Reply-To: " +
      LOCATOR_MAIL_IDENTITY.replyTo,
    "To: " +
      String(
        to ||
        ""
      ),
    bcc
      ? "Bcc: " +
        String(
          bcc
        )
      : "",
    "Subject: " +
      locatorMimeHeader_(
        subject
      ),
    "MIME-Version: 1.0",
    "Content-Type: multipart/mixed; boundary=\"" +
      boundary +
      "\"",
    "",
    "--" +
      boundary,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    bodyBase64,
    "--" +
      boundary,
    "Content-Type: application/pdf; name=\"" +
      locatorMimeFilename_(
        filename
      ) +
      "\"",
    "Content-Disposition: attachment; filename=\"" +
      locatorMimeFilename_(
        filename
      ) +
      "\"",
    "Content-Transfer-Encoding: base64",
    "",
    pdfBase64,
    "--" +
      boundary +
      "--",
    ""
  ]
    .filter(
      value =>
        value !==
        null &&
        value !==
        undefined
    );

  return lines.join(
    "\r\n"
  );
}


function locatorMailAddressHeader_(
  displayName,
  email
) {
  return (
    locatorMimeHeader_(
      displayName
    ) +
    " <" +
    email +
    ">"
  );
}


function locatorMimeHeader_(
  value
) {
  const text =
    String(
      value ||
      ""
    );

  if (
    /^[\x20-\x7E]*$/.test(
      text
    )
  ) {
    return text
      .replace(
        /[\r\n]+/g,
        " "
      );
  }

  return (
    "=?UTF-8?B?" +
    Utilities.base64Encode(
      text,
      Utilities.Charset.UTF_8
    ) +
    "?="
  );
}


function locatorMimeFilename_(
  value
) {
  return String(
    value ||
    "attachment.pdf"
  )
    .replace(
      /[\r\n\"\\]/g,
      "_"
    );
}


function locatorWrapBase64_(
  value
) {
  return String(
    value ||
    ""
  )
    .match(
      /.{1,76}/g
    )
    ?.join(
      "\r\n"
    ) ||
    "";
}


function locatorBase64WebSafe_(
  value
) {
  return Utilities
    .base64EncodeWebSafe(
      String(
        value ||
        ""
      ),
      Utilities.Charset.UTF_8
    )
    .replace(
      /=+$/,
      ""
    );
}


function locatorEscapeHtml_(
  value
) {
  return String(
    value ||
    ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /\"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* ============================================================
 * SEARCH
 * ========================================================== */

function locatorSearchApartments_(
  criteria
) {
  criteria =
    criteria ||
    {};

  const communities =
    locatorReadCommunities_();

  const communityMap =
    {};

  communities.forEach(
    item => {
      communityMap[
        item.communityId
      ] =
        item;
    }
  );

  const floorplans =
    locatorReadFloorplans_();

  const area =
    locatorNormalizeText_(
      criteria.area
    );

  const wantedBeds =
    locatorNullableNumber_(
      criteria.beds
    );

  const bathsMin =
    locatorNullableNumber_(
      criteria.bathsMin
    );

  const minRent =
    locatorNullableNumber_(
      criteria.minRent
    );

  const maxRent =
    locatorNullableNumber_(
      criteria.maxRent
    );

  const priceMode =
    String(
      criteria.priceMode ||
      "net"
    )
      .toLowerCase() ===
    "base"
      ? "base"
      : "net";

  const moveInDate =
    locatorParseDate_(
      criteria.moveInDate
    );

  const availableOnly =
    criteria.availableOnly !==
    false;

  const geography =
    criteria.geography ||
    null;

  const results =
    [];

  floorplans.forEach(
    floorplan => {
      const community =
        communityMap[
          floorplan.communityId
        ];

      if (!community) {
        return;
      }

      if (
        area &&
        !locatorCommunityMatchesArea_(
          community,
          area
        )
      ) {
        return;
      }

      const beds =
        locatorNullableNumber_(
          floorplan.beds
        );

      if (
        wantedBeds !==
        null
      ) {
        if (
          wantedBeds >=
          4
        ) {
          if (
            beds ===
              null ||
            beds <
              4
          ) {
            return;
          }
        }
        else if (
          beds !==
          wantedBeds
        ) {
          return;
        }
      }

      const baths =
        locatorNullableNumber_(
          floorplan.baths
        );

      if (
        bathsMin !==
          null &&
        (
          baths ===
            null ||
          baths <
            bathsMin
        )
      ) {
        return;
      }

      let availability =
        Array.isArray(
          floorplan.availability
        )
          ? [
              ...floorplan.availability
            ]
          : [];

      if (
        moveInDate
      ) {
        availability =
          availability.filter(
            row => {
              const date =
                locatorAvailabilityDate_(
                  row
                );

              return (
                date &&
                date.getTime() <=
                  moveInDate.getTime()
              );
            }
          );
      }

      if (
        availableOnly &&
        availability.length ===
          0
      ) {
        return;
      }

      if (
        geography &&
        !locatorCommunityMatchesGeography_(
          community,
          geography
        )
      ) {
        return;
      }

      const enriched =
        locatorBuildSearchResult_(
          floorplan,
          community,
          availability
        );

      const priceForFilter =
        priceMode ===
          "base"
          ? enriched.baseRent
          : enriched.netEffectiveRent;

      if (
        minRent !==
          null &&
        (
          priceForFilter ===
            null ||
          priceForFilter <
            minRent
        )
      ) {
        return;
      }

      if (
        maxRent !==
          null &&
        (
          priceForFilter ===
            null ||
          priceForFilter >
            maxRent
        )
      ) {
        return;
      }

      results.push(
        enriched
      );
    }
  );

  results.sort(
    (
      a,
      b
    ) => {
      const aPrice =
        priceMode ===
          "base"
          ? a.baseRent
          : a.netEffectiveRent;

      const bPrice =
        priceMode ===
          "base"
          ? b.baseRent
          : b.netEffectiveRent;

      if (
        aPrice ===
        null
      ) {
        return 1;
      }

      if (
        bPrice ===
        null
      ) {
        return -1;
      }

      return (
        aPrice -
        bPrice
      );
    }
  );

  return {
    results
  };
}


function locatorBuildSearchResult_(
  floorplan,
  community,
  availability
) {
  const rows =
    Array.isArray(
      availability
    )
      ? availability
      : [];

  const pricedRows =
    rows
      .map(
        row => ({
          row,
          rent:
            locatorAvailabilityRent_(
              row
            )
        })
      )
      .filter(
        item =>
          item.rent !==
          null
      )
      .sort(
        (
          a,
          b
        ) =>
          a.rent -
          b.rent
      );

  const baseRent =
    pricedRows.length
      ? pricedRows[0].rent
      : null;

  const baseRow =
    pricedRows.length
      ? pricedRows[0].row
      : (
          rows[0] ||
          null
        );

  const interpretation =
    locatorParseSpecial_(
      community.specialText ||
      floorplan.specialText ||
      ""
    );

  const calculation =
    locatorCalculateNetEffectiveRent_(
      baseRent,
      baseRow,
      interpretation
    );

  const availabilityDates =
    rows
      .map(
        row =>
          locatorAvailabilityDate_(
            row
          )
      )
      .filter(
        Boolean
      )
      .sort(
        (
          a,
          b
        ) =>
          a.getTime() -
          b.getTime()
      );

  return {
    floorplanId:
      floorplan.floorplanId,

    communityId:
      floorplan.communityId,

    communityUrl:
      community.url,

    floorplanName:
      floorplan.floorplanName,

    beds:
      floorplan.beds,

    baths:
      floorplan.baths,

    sqft:
      floorplan.sqft,

    baseRent,

    netEffectiveRent:
      calculation.rent,

    actualLeaseTermMonths:
      calculation.actualLeaseTermMonths,

    specialMinimumLeaseTermMonths:
      calculation.specialMinimumLeaseTermMonths,

    calculationLeaseTermMonths:
      calculation.calculationLeaseTermMonths,

    leaseTermQualified:
      calculation.leaseTermQualified,

    leaseTermWarning:
      calculation.warning,

    specialText:
      interpretation.raw,

    specialType:
      interpretation.type,

    specialSummary:
      locatorSpecialSummary_(
        interpretation
      ),

    specialInterpretation:
      interpretation,

    specialApplicability:
      interpretation.needsReview
        ? "needs_review"
        : (
            calculation.actualLeaseTermMonths !== null &&
            calculation.leaseTermQualified === false
              ? "does_not_apply"
              : "applies"
          ),

    specialApplicabilityReason:
      interpretation.needsReview
        ? "Advertised special contains select/up-to/ambiguous language; calculation is an estimate until confirmed."
        : (calculation.warning || "Automatic special interpretation."),

    availabilityCount:
      rows.length,

    availableNow:
      rows.some(
        row =>
          locatorAvailabilityIsNow_(
            row
          )
      ),

    earliestAvailabilityDate:
      availabilityDates.length
        ? Utilities.formatDate(
            availabilityDates[0],
            Session.getScriptTimeZone(),
            "yyyy-MM-dd"
          )
        : "",

    address:
      community.address,

    city:
      community.city,

    state:
      community.state,

    zip:
      community.zip,

    latitude:
      community.latitude,

    longitude:
      community.longitude,

    guestCardEmail:
      community.guestCardEmail,

    tourEmail:
      community.tourEmail,

    tourUrl:
      community.tourUrl,

    availability:
      rows.slice(
        0,
        50
      )
  };
}


/* ============================================================
 * READ FLOORPLAN / COMMUNITY
 * ========================================================== */

function locatorGetFloorplan_(
  floorplanId
) {
  const wanted =
    String(
      floorplanId ||
      ""
    ).trim();

  const floorplan =
    locatorReadFloorplans_()
      .find(
        item =>
          item.floorplanId ===
          wanted
      );

  if (!floorplan) {
    throw new Error(
      "Floorplan not found."
    );
  }

  const community =
    locatorGetCommunity_(
      floorplan.communityId
    );

  return locatorBuildSearchResult_(
    floorplan,
    community,
    floorplan.availability
  );
}


function locatorGetCommunity_(
  communityId
) {
  const wanted =
    String(
      communityId || ""
    ).trim();

  const community =
    locatorReadCommunities_()
      .find(
        item =>
          item.communityId ===
          wanted
      );

  if (!community) {
    throw new Error(
      "Community not found."
    );
  }

  return community;
}


function locatorGetCommunityContact_(
  communityId
) {
  const community =
    locatorGetCommunity_(
      communityId
    );

  return {
    communityId:
      community.communityId,

    communityUrl:
      community.url,

    guestCardEmail:
      community.guestCardEmail,

    tourEmail:
      community.tourEmail,

    emailNotes:
      community.emailNotes
  };
}


/* ============================================================
 * APARTMENT DATABASE WRITES
 *
 * There are deliberately NO generic update methods.
 * ========================================================== */

function locatorSetCommunityEmails_(
  request
) {
  const communityId =
    String(
      request.communityId || ""
    ).trim();

  if (!communityId) {
    throw new Error(
      "CommunityID is required."
    );
  }

  const sheet =
    locatorApartmentSheet_(
      LOCATOR_SHEETS.COMMUNITIES
    );

  const columns =
    locatorHeaderMap_(
      sheet
    );

  const rowNumber =
    locatorFindRowByColumn_(
      sheet,
      columns,
      "CommunityID",
      communityId
    );

  if (!rowNumber) {
    throw new Error(
      "Community not found."
    );
  }


  locatorWriteAllowedCommunityField_(
    sheet,
    columns,
    rowNumber,
    "GuestCardEmail",
    locatorNormalizeEmail_(
      request.guestCardEmail
    )
  );


  locatorWriteAllowedCommunityField_(
    sheet,
    columns,
    rowNumber,
    "TourEmail",
    locatorNormalizeEmail_(
      request.tourEmail
    )
  );


  locatorWriteAllowedCommunityField_(
    sheet,
    columns,
    rowNumber,
    "EmailNotes",
    String(
      request.emailNotes || ""
    ).trim()
  );


  locatorWriteAllowedCommunityField_(
    sheet,
    columns,
    rowNumber,
    "EmailUpdatedAt",
    new Date()
  );


  SpreadsheetApp.flush();


  return locatorGetCommunityContact_(
    communityId
  );
}


function locatorSetCommunityCoordinates_(
  request
) {
  const communityId =
    String(
      request.communityId || ""
    ).trim();

  const latitude =
    Number(
      request.latitude
    );

  const longitude =
    Number(
      request.longitude
    );

  if (!communityId) {
    throw new Error(
      "CommunityID is required."
    );
  }

  if (
    !Number.isFinite(
      latitude
    ) ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new Error(
      "Invalid latitude."
    );
  }

  if (
    !Number.isFinite(
      longitude
    ) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      "Invalid longitude."
    );
  }


  const sheet =
    locatorApartmentSheet_(
      LOCATOR_SHEETS.COMMUNITIES
    );

  const columns =
    locatorHeaderMap_(
      sheet
    );

  const rowNumber =
    locatorFindRowByColumn_(
      sheet,
      columns,
      "CommunityID",
      communityId
    );

  if (!rowNumber) {
    throw new Error(
      "Community not found."
    );
  }


  locatorWriteAllowedCommunityField_(
    sheet,
    columns,
    rowNumber,
    "Latitude",
    latitude
  );


  locatorWriteAllowedCommunityField_(
    sheet,
    columns,
    rowNumber,
    "Longitude",
    longitude
  );


  locatorWriteAllowedCommunityField_(
    sheet,
    columns,
    rowNumber,
    "CoordinatesUpdatedAt",
    new Date()
  );


  SpreadsheetApp.flush();


  return locatorGetCommunity_(
    communityId
  );
}


/* ============================================================
 * GEOCODING
 * ========================================================== */

function locatorGeocodeLocation_(
  query
) {
  const text =
    String(
      query || ""
    ).trim();

  if (!text) {
    throw new Error(
      "A location is required."
    );
  }

  const response =
    Maps
      .newGeocoder()
      .setRegion(
        "us"
      )
      .geocode(
        text
      );

  const result =
    response &&
    Array.isArray(
      response.results
    )
      ? response.results[0]
      : null;

  if (
    !result ||
    !result.geometry ||
    !result.geometry.location
  ) {
    throw new Error(
      "Location could not be geocoded."
    );
  }

  return {
    formattedAddress:
      result.formatted_address ||
      text,

    latitude:
      result.geometry.location.lat,

    longitude:
      result.geometry.location.lng
  };
}


function locatorGeocodeCommunity_(
  communityId
) {
  const community =
    locatorGetCommunity_(
      communityId
    );

  const address =
    locatorCommunityAddressForGeocode_(
      community
    );

  if (!address) {
    throw new Error(
      "Community does not have enough address information to geocode."
    );
  }

  const geocoded =
    locatorGeocodeLocation_(
      address
    );

  return locatorSetCommunityCoordinates_({
    communityId:
      community.communityId,

    latitude:
      geocoded.latitude,

    longitude:
      geocoded.longitude
  });
}


/**
 * Run manually from Apps Script whenever you add communities.
 * It changes ONLY Latitude / Longitude / CoordinatesUpdatedAt.
 */
function locatorGeocodeCommunitiesBatch(
  limit
) {
  const max =
    Math.max(
      1,
      Math.min(
        100,
        Number(
          limit || 20
        )
      )
    );

  const communities =
    locatorReadCommunities_();

  let processed = 0;
  let updated = 0;
  const failures = [];

  for (
    const community
    of communities
  ) {

    if (
      processed >=
      max
    ) {
      break;
    }

    if (
      community.latitude !==
        null &&
      community.longitude !==
        null &&
      Number.isFinite(
        community.latitude
      ) &&
      Number.isFinite(
        community.longitude
      )
    ) {
      continue;
    }

    processed++;

    try {

      locatorGeocodeCommunity_(
        community.communityId
      );

      updated++;

      Utilities.sleep(
        150
      );

    }
    catch (
      error
    ) {

      failures.push({
        communityId:
          community.communityId,

        communityUrl:
          community.url,

        address:
          community.address,

        city:
          community.city,

        state:
          community.state,

        zip:
          community.zip,

        error:
          error.message
      });

    }

  }


  const remaining =
    locatorReadCommunities_()
      .filter(
        item =>
          item.latitude ===
            null ||
          item.longitude ===
            null ||
          !Number.isFinite(
            item.latitude
          ) ||
          !Number.isFinite(
            item.longitude
          )
      )
      .length;


  return {
    processed,
    updated,
    failures,
    remaining
  };
}


/* ============================================================
 * OPERATIONS — GUEST CARDS / EMAIL / TOURS
 * ========================================================== */

function locatorSendGuestCard_(
  guestCard
) {
  guestCard =
    guestCard ||
    {};

  const lead =
    guestCard.lead ||
    {};

  const targets =
    Array.isArray(
      guestCard.targets
    )
      ? guestCard.targets
      : [];

  if (
    !targets.length
  ) {
    throw new Error(
      "Select at least one guest-card recipient."
    );
  }

  const clientName =
    locatorClientFullName_(
      lead
    );

  const clientEmail =
    locatorNormalizeEmail_(
      lead.email
    );

  const clientPhone =
    String(
      lead.phone ||
      ""
    ).trim();

  if (
    !clientName ||
    !clientEmail ||
    !clientPhone
  ) {
    throw new Error(
      "Guest Card requires client first/last name, email and phone."
    );
  }

  const oauthStatus =
    locatorGetGmailOAuthStatus_();

  if (!oauthStatus.connected) {
    throw new Error(
      "Connect Gmail OAuth as " +
      LOCATOR_MAIL_IDENTITY.sendAs +
      " before sending a Guest Card."
    );
  }

  const agentEmail =
    locatorNormalizeEmail_(
      LOCATOR_MAIL_IDENTITY.replyTo
    );

  const uniqueRecipients =
    {};

  const interests =
    [];

  targets.forEach(
    target => {
      const community =
        locatorGetCommunity_(
          target.communityId
        );

      const recipient =
        locatorNormalizeEmail_(
          community.guestCardEmail
        );

      if (!recipient) {
        throw new Error(
          "No GuestCardEmail is saved for " +
          (
            community.url ||
            community.communityId
          )
        );
      }

      uniqueRecipients[
        recipient
      ] =
        true;

      const floorplan =
        locatorGetFloorplan_(
          target.floorplanId
        );

      interests.push({
        communityId:
          community.communityId,

        communityUrl:
          community.url,

        floorplanId:
          floorplan.floorplanId,

        floorplanName:
          floorplan.floorplanName,

        beds:
          floorplan.beds,

        baths:
          floorplan.baths,

        sqft:
          floorplan.sqft
      });
    }
  );

  const recipients =
    Object.keys(
      uniqueRecipients
    );

  const subject =
    "Guest Card - " +
    clientName;

  const pdf =
    locatorCreateGuestCardPdf_(
      lead,
      interests
    );

  const body = [
    "Guest Card attached for " +
      clientName +
      ".",
    "",
    String(
      guestCard.message ||
      ""
    ).trim()
  ]
    .filter(
      value =>
        value !==
        ""
    )
    .join(
      "\n"
    );

  const sentAt =
    new Date();

  const rawMessage =
    locatorBuildPdfMime_(
      agentEmail,
      recipients.join(","),
      subject,
      body,
      pdf
    );

  const gmailResult =
    locatorSendGmailRaw_(
      rawMessage
    );

  const guestCardId =
    "GC-" +
    Utilities.getUuid();

  locatorAppendOperation_(
    LOCATOR_SHEETS.GUEST_CARDS,
    {
      GuestCardID:
        guestCardId,

      CommunityIDs:
        interests
          .map(
            item =>
              item.communityId
          )
          .join(
            "\n"
          ),

      CommunityURLs:
        interests
          .map(
            item =>
              item.communityUrl
          )
          .join(
            "\n"
          ),

      FloorplanIDs:
        interests
          .map(
            item =>
              item.floorplanId
          )
          .join(
            "\n"
          ),

      ClientName:
        clientName,

      ClientEmail:
        clientEmail,

      ClientPhone:
        clientPhone,

      MoveInDate:
        String(
          lead.moveIn ||
          ""
        ),

      ToEmail:
        agentEmail,

      BccRecipients:
        recipients.join(
          ", "
        ),

      Subject:
        subject,

      PdfFileName:
        pdf.getName(),

      SentAt:
        sentAt,

      Status:
        "Sent",

      GmailMessageID:
        gmailResult.id ||
        ""
    }
  );

  const emailLogId =
    locatorLogEmailSent_({
      type:
        "GuestCard",

      recipient:
        agentEmail,

      bccRecipients:
        recipients.join(
          ", "
        ),

      subject,

      sentAt,

      status:
        "Sent",

      relatedGuestCardId:
        guestCardId
    })
      .emailLogId;

  return {
    guestCardId,
    emailLogId,
    bccCount:
      recipients.length,
    recipients,
    gmailMessageId:
      gmailResult.id ||
      "",
    sentAt:
      sentAt.toISOString()
  };
}


function locatorCreateGuestCardPdf_(
  lead,
  interests
) {
  const clientName =
    locatorClientFullName_(
      lead
    );

  const document =
    DocumentApp.create(
      "Guest Card - " +
      clientName
    );

  const body =
    document.getBody();

  const title =
    body.appendParagraph(
      "GUEST CARD"
    );

  title.setHeading(
    DocumentApp
      .ParagraphHeading
      .TITLE
  );

  title.setAlignment(
    DocumentApp
      .HorizontalAlignment
      .CENTER
  );

  body.appendParagraph(
    clientName
  )
    .setHeading(
      DocumentApp
        .ParagraphHeading
        .HEADING1
    );

  const rows = [
    [
      "Phone",
      String(
        lead.phone ||
        ""
      )
    ],
    [
      "Email",
      String(
        lead.email ||
        ""
      )
    ],
    [
      "Desired area",
      String(
        lead.area ||
        ""
      )
    ],
    [
      "Move-in",
      String(
        lead.moveIn ||
        ""
      ) +
      (
        lead.moveFlexible
          ? " (flexible)"
          : ""
      )
    ],
    [
      "Budget",
      lead.budget
        ? "$" +
          Number(
            lead.budget
          )
            .toLocaleString()
        : ""
    ],
    [
      "Bedrooms",
      String(
        lead.beds ??
        ""
      )
    ],
    [
      "Bathrooms",
      String(
        lead.baths ??
        ""
      )
    ],
    [
      "Reason for move",
      String(
        lead.moveReason ||
        ""
      )
    ],
    [
      "Credit status",
      String(
        lead.creditStatus ||
        ""
      )
    ],
    [
      "Background",
      Array.isArray(
        lead.backgroundIssues
      )
        ? lead.backgroundIssues.join(
            ", "
          )
        : ""
    ],
    [
      "Pets / notes",
      String(
        lead.pets ||
        ""
      )
    ]
  ];

  const table =
    body.appendTable(
      rows
    );

  for (
    let r = 0;
    r <
    table.getNumRows();
    r++
  ) {
    table
      .getRow(
        r
      )
      .getCell(
        0
      )
      .editAsText()
      .setBold(
        true
      );
  }

  if (
    interests &&
    interests.length
  ) {
    body.appendParagraph(
      "Apartment interests"
    )
      .setHeading(
        DocumentApp
          .ParagraphHeading
          .HEADING2
      );

    interests.forEach(
      item => {
        body.appendListItem(
          [
            item.communityUrl ||
              "",
            item.floorplanName ||
              "",
            String(
              item.beds ??
              ""
            ) +
              " bed / " +
              String(
                item.baths ??
                ""
              ) +
              " bath",
            item.sqft
              ? String(
                  item.sqft
                ) +
                " sqft"
              : ""
          ]
            .filter(
              Boolean
            )
            .join(
              " • "
            )
        );
      }
    );
  }

  document.saveAndClose();

  const file =
    DriveApp.getFileById(
      document.getId()
    );

  const pdf =
    file
      .getAs(
        MimeType.PDF
      )
      .setName(
        "Guest Card - " +
        clientName +
        ".pdf"
      );

  file.setTrashed(
    true
  );

  return pdf;
}


function locatorSendTourRequests_(
  request
) {
  request =
    request ||
    {};

  const lead =
    request.lead ||
    {};

  const clientName =
    locatorClientFullName_(
      lead
    );

  if (!clientName) {
    throw new Error(
      "Client name is required for tour requests."
    );
  }

  const requests =
    Array.isArray(
      request.requests
    )
      ? request.requests
      : [];

  if (!requests.length) {
    throw new Error(
      "No tour requests were provided."
    );
  }

  const results =
    [];

  requests.forEach(
    tour => {
      const community =
        locatorGetCommunity_(
          tour.communityId
        );

      const recipient =
        locatorNormalizeEmail_(
          community.tourEmail ||
          community.guestCardEmail
        );

      if (!recipient) {
        throw new Error(
          "No TourEmail or GuestCardEmail is saved for " +
          (
            community.url ||
            community.communityId
          )
        );
      }

      const floorplan =
        locatorGetFloorplan_(
          tour.floorplanId
        );

      const subject =
        "Tour Request - " +
        clientName +
        " - " +
        String(
          tour.tourDate ||
          ""
        ) +
        " " +
        String(
          tour.tourTime ||
          ""
        );

      const body = [
        "Hello,",
        "",
        "Just to let you know, I am the apartment locator assisting " +
          clientName +
          " and I am trying to schedule a tour for:",
        "",
        "Date: " +
          String(
            tour.tourDate ||
            ""
          ),
        "Time: " +
          String(
            tour.tourTime ||
            ""
          ),
        "Floorplan: " +
          String(
            floorplan.floorplanName ||
            ""
          ),
        "Property: " +
          String(
            community.url ||
            ""
          ),
        lead.phone
          ? "Client phone: " +
            lead.phone
          : "",
        lead.email
          ? "Client email: " +
            lead.email
          : "",
        tour.note
          ? "Note: " +
            tour.note
          : "",
        "",
        "Please let me know if that time is unavailable or if anything else is needed to confirm the tour.",
        "",
        "Thank you."
      ]
        .filter(
          value =>
            value !==
            ""
        )
        .join(
          "\n"
        );

      const oauthStatus =
        locatorGetGmailOAuthStatus_();

      if (!oauthStatus.connected) {
        throw new Error(
          "Connect Gmail OAuth as " +
          LOCATOR_MAIL_IDENTITY.sendAs +
          " before sending tour requests."
        );
      }

      const rawMessage =
        locatorBuildPlainTextMime_(
          recipient,
          "",
          subject,
          body
        );

      const gmailResult =
        locatorSendGmailRaw_(
          rawMessage
        );

      const sentAt =
        new Date();

      const tourId =
        "TOUR-" +
        Utilities.getUuid();

      locatorAppendOperation_(
        LOCATOR_SHEETS.TOURS,
        {
          TourID:
            tourId,

          CommunityID:
            community.communityId,

          CommunityURL:
            community.url,

          FloorplanID:
            floorplan.floorplanId,

          ClientName:
            clientName,

          ClientEmail:
            String(
              lead.email ||
              ""
            ),

          ClientPhone:
            String(
              lead.phone ||
              ""
            ),

          TourDate:
            String(
              tour.tourDate ||
              ""
            ),

          TourTime:
            String(
              tour.tourTime ||
              ""
            ),

          SchedulingURL:
            community.tourUrl ||
            "",

          Recipient:
            recipient,

          Status:
            "Requested",

          GmailMessageID:
            gmailResult.id ||
            "",

          LoggedAt:
            sentAt
        }
      );

      const emailLogId =
        locatorLogEmailSent_({
          type:
            "TourRequest",

          communityId:
            community.communityId,

          floorplanId:
            floorplan.floorplanId,

          recipient,

          subject,

          sentAt,

          status:
            "Sent",

          relatedTourId:
            tourId
        })
          .emailLogId;

      results.push({
        tourId,
        emailLogId,
        recipient,
        communityUrl:
          community.url,
        floorplanId:
          floorplan.floorplanId,
        gmailMessageId:
          gmailResult.id ||
          ""
      });
    }
  );

  return {
    sentCount:
      results.length,
    results
  };
}


function locatorLogTour_(
  tour
) {
  tour =
    tour ||
    {};

  const communityId =
    String(
      tour.communityId ||
      ""
    ).trim();

  if (!communityId) {
    throw new Error(
      "CommunityID is required for a tour log."
    );
  }

  const community =
    locatorGetCommunity_(
      communityId
    );

  const tourId =
    "TOUR-" +
    Utilities.getUuid();

  locatorAppendOperation_(
    LOCATOR_SHEETS.TOURS,
    {
      TourID:
        tourId,

      CommunityID:
        communityId,

      CommunityURL:
        community.url,

      FloorplanID:
        String(
          tour.floorplanId ||
          ""
        ).trim(),

      ClientName:
        String(
          tour.clientName ||
          ""
        ).trim(),

      ClientEmail:
        String(
          tour.clientEmail ||
          ""
        ).trim(),

      ClientPhone:
        String(
          tour.clientPhone ||
          ""
        ).trim(),

      TourDate:
        String(
          tour.tourDate ||
          ""
        ),

      TourTime:
        String(
          tour.tourTime ||
          ""
        ),

      SchedulingURL:
        String(
          tour.schedulingUrl ||
          ""
        ).trim(),

      Recipient:
        String(
          tour.recipient ||
          ""
        ).trim(),

      Status:
        String(
          tour.status ||
          "Requested"
        ).trim(),

      LoggedAt:
        new Date()
    }
  );

  return {
    tourId
  };
}


function locatorLogEmailSent_(
  email
) {
  email =
    email ||
    {};

  const emailLogId =
    "EMAIL-" +
    Utilities.getUuid();


  locatorAppendOperation_(
    LOCATOR_SHEETS.EMAIL_LOG,
    {
      EmailLogID:
        emailLogId,

      Type:
        String(
          email.type || ""
        ).trim(),

      CommunityID:
        String(
          email.communityId || ""
        ).trim(),

      FloorplanID:
        String(
          email.floorplanId || ""
        ).trim(),

      Recipient:
        locatorNormalizeEmail_(
          email.recipient
        ),

      BccRecipients:
        String(
          email.bccRecipients ||
          ""
        ).trim(),

      Subject:
        String(
          email.subject || ""
        ).trim(),

      SentAt:
        email.sentAt
          ? new Date(
              email.sentAt
            )
          : new Date(),

      Status:
        String(
          email.status ||
          "Sent"
        ).trim(),

      RelatedGuestCardID:
        String(
          email.relatedGuestCardId || ""
        ).trim(),

      RelatedTourID:
        String(
          email.relatedTourId || ""
        ).trim()
    }
  );


  return {
    emailLogId
  };
}


/* ============================================================
 * SPREADSHEET READERS
 * ========================================================== */

function locatorReadCommunities_() {
  const sheet =
    locatorApartmentSheet_(
      LOCATOR_SHEETS.COMMUNITIES
    );

  const rows =
    locatorSheetObjects_(
      sheet
    );

  return rows
    .map(
      row => {

        const communityId =
          locatorPick_(
            row,
            [
              "CommunityID"
            ]
          );

        if (!communityId) {
          return null;
        }

        return {

          communityId:
            String(
              communityId
            ).trim(),

          communityName:
            String(
              locatorPick_(
                row,
                [
                  "CommunityName",
                  "Name",
                  "PropertyName"
                ]
              ) ||
              communityId
            ).trim(),

          address:
            String(
              locatorPick_(
                row,
                [
                  "Address",
                  "StreetAddress"
                ]
              ) ||
              ""
            ).trim(),

          city:
            String(
              locatorPick_(
                row,
                [
                  "City"
                ]
              ) ||
              ""
            ).trim(),

          state:
            String(
              locatorPick_(
                row,
                [
                  "State"
                ]
              ) ||
              ""
            ).trim(),

          zip:
            String(
              locatorPick_(
                row,
                [
                  "Zip",
                  "ZIP",
                  "ZipCode",
                  "PostalCode"
                ]
              ) ||
              ""
            ).trim(),

          url:
            String(
              locatorPick_(
                row,
                [
                  "URL",
                  "CommunityURL",
                  "Website"
                ]
              ) ||
              ""
            ).trim(),

          tourUrl:
            String(
              locatorPick_(
                row,
                [
                  "TourURL",
                  "SchedulingURL",
                  "ScheduleTourURL"
                ]
              ) ||
              ""
            ).trim(),

          latitude:
            locatorNullableNumber_(
              locatorPick_(
                row,
                [
                  "Latitude"
                ]
              )
            ),

          longitude:
            locatorNullableNumber_(
              locatorPick_(
                row,
                [
                  "Longitude"
                ]
              )
            ),

          guestCardEmail:
            String(
              locatorPick_(
                row,
                [
                  "GuestCardEmail"
                ]
              ) ||
              ""
            ).trim(),

          tourEmail:
            String(
              locatorPick_(
                row,
                [
                  "TourEmail"
                ]
              ) ||
              ""
            ).trim(),

          emailNotes:
            String(
              locatorPick_(
                row,
                [
                  "EmailNotes"
                ]
              ) ||
              ""
            ).trim(),

          specialText:
            String(
              locatorPick_(
                row,
                [
                  "Special",
                  "Specials",
                  "Promotion",
                  "CurrentSpecial"
                ]
              ) ||
              ""
            ).trim()

        };

      }
    )
    .filter(
      Boolean
    );
}


function locatorReadFloorplans_() {
  const sheet =
    locatorApartmentSheet_(
      LOCATOR_SHEETS.FLOORPLANS
    );

  const rows =
    locatorSheetObjects_(
      sheet
    );

  return rows
    .map(
      row => {

        const floorplanId =
          locatorPick_(
            row,
            [
              "FloorplanID"
            ]
          );

        const communityId =
          locatorPick_(
            row,
            [
              "CommunityID"
            ]
          );

        if (
          !floorplanId ||
          !communityId
        ) {
          return null;
        }


        let availability = [];

        const rawAvailability =
          locatorPick_(
            row,
            [
              "AvailabilityJSON"
            ]
          );


        if (
          Array.isArray(
            rawAvailability
          )
        ) {

          availability =
            rawAvailability;

        }
        else {

          try {

            availability =
              JSON.parse(
                String(
                  rawAvailability ||
                  "[]"
                )
              );

            if (
              !Array.isArray(
                availability
              )
            ) {
              availability = [];
            }

          }
          catch {
            availability = [];
          }

        }


        return {

          floorplanId:
            String(
              floorplanId
            ).trim(),

          communityId:
            String(
              communityId
            ).trim(),

          floorplanName:
            String(
              locatorPick_(
                row,
                [
                  "Name",
                  "FloorplanName"
                ]
              ) ||
              ""
            ).trim(),

          beds:
            locatorPick_(
              row,
              [
                "Beds",
                "Bedrooms"
              ]
            ),

          baths:
            locatorPick_(
              row,
              [
                "Baths",
                "Bathrooms"
              ]
            ),

          sqft:
            locatorPick_(
              row,
              [
                "SqFt",
                "SquareFeet"
              ]
            ),

          availability,

          specialText:
            String(
              locatorPick_(
                row,
                [
                  "Special",
                  "Specials",
                  "Promotion",
                  "CurrentSpecial"
                ]
              ) ||
              ""
            ).trim()

        };

      }
    )
    .filter(
      Boolean
    );
}


/* ============================================================
 * GEOGRAPHIC FILTERS
 * ========================================================== */

function locatorCommunityMatchesGeography_(
  community,
  geography
) {
  const point = {
    lat:
      locatorNullableNumber_(
        community.latitude
      ),

    lng:
      locatorNullableNumber_(
        community.longitude
      )
  };


  if (
    point.lat ===
      null ||
    point.lng ===
      null
  ) {
    return false;
  }


  const type =
    String(
      geography.type || ""
    ).toLowerCase();


  if (
    type ===
    "polygon"
  ) {

    return locatorPointInPolygon_(
      point,
      geography.points || []
    );

  }


  if (
    type ===
    "circle"
  ) {

    const center =
      geography.center;

    const radius =
      Number(
        geography.radiusMiles ||
        0
      );

    if (
      !center ||
      !radius
    ) {
      return true;
    }

    return (
      locatorHaversineMiles_(
        point,
        center
      ) <=
      radius
    );

  }


  if (
    type ===
    "line"
  ) {

    const points =
      Array.isArray(
        geography.points
      )
        ? geography.points
        : [];

    const corridor =
      Number(
        geography.corridorMiles ||
        1
      );

    if (
      points.length <
      2
    ) {
      return true;
    }

    let minimum =
      Infinity;

    for (
      let i = 0;
      i <
      points.length - 1;
      i++
    ) {

      minimum =
        Math.min(
          minimum,
          locatorDistancePointToSegmentMiles_(
            point,
            points[i],
            points[i + 1]
          )
        );

    }

    return (
      minimum <=
      corridor
    );

  }


  return true;
}


function locatorPointInPolygon_(
  point,
  polygon
) {
  if (
    !Array.isArray(
      polygon
    ) ||
    polygon.length <
    3
  ) {
    return true;
  }

  let inside =
    false;

  for (
    let i = 0,
        j =
          polygon.length - 1;
    i <
    polygon.length;
    j = i++
  ) {

    const xi =
      Number(
        polygon[i].lng
      );

    const yi =
      Number(
        polygon[i].lat
      );

    const xj =
      Number(
        polygon[j].lng
      );

    const yj =
      Number(
        polygon[j].lat
      );


    const intersects =
      (
        (yi > point.lat) !==
        (yj > point.lat)
      ) &&
      (
        point.lng <
        (
          (xj - xi) *
          (point.lat - yi) /
          (yj - yi || 1e-12) +
          xi
        )
      );


    if (
      intersects
    ) {
      inside =
        !inside;
    }

  }

  return inside;
}


function locatorHaversineMiles_(
  a,
  b
) {
  const R =
    3958.7613;

  const rad =
    value =>
      Number(
        value
      ) *
      Math.PI /
      180;

  const dLat =
    rad(
      b.lat -
      a.lat
    );

  const dLng =
    rad(
      b.lng -
      a.lng
    );

  const lat1 =
    rad(
      a.lat
    );

  const lat2 =
    rad(
      b.lat
    );


  const h =
    Math.sin(
      dLat /
      2
    ) ** 2 +
    Math.cos(
      lat1
    ) *
    Math.cos(
      lat2
    ) *
    Math.sin(
      dLng /
      2
    ) ** 2;


  return (
    2 *
    R *
    Math.asin(
      Math.sqrt(
        h
      )
    )
  );
}


/**
 * Local projection is sufficient for short apartment-search corridors.
 */
function locatorDistancePointToSegmentMiles_(
  point,
  a,
  b
) {
  const lat0 =
    (
      Number(
        point.lat
      ) +
      Number(
        a.lat
      ) +
      Number(
        b.lat
      )
    ) /
    3;


  const milesPerLat =
    69.0;

  const milesPerLng =
    69.172 *
    Math.cos(
      lat0 *
      Math.PI /
      180
    );


  const px =
    Number(
      point.lng
    ) *
    milesPerLng;

  const py =
    Number(
      point.lat
    ) *
    milesPerLat;


  const ax =
    Number(
      a.lng
    ) *
    milesPerLng;

  const ay =
    Number(
      a.lat
    ) *
    milesPerLat;


  const bx =
    Number(
      b.lng
    ) *
    milesPerLng;

  const by =
    Number(
      b.lat
    ) *
    milesPerLat;


  const dx =
    bx - ax;

  const dy =
    by - ay;


  const lengthSquared =
    dx * dx +
    dy * dy;


  if (
    lengthSquared ===
    0
  ) {

    return Math.hypot(
      px - ax,
      py - ay
    );

  }


  let t =
    (
      (
        px - ax
      ) *
      dx +
      (
        py - ay
      ) *
      dy
    ) /
    lengthSquared;


  t =
    Math.max(
      0,
      Math.min(
        1,
        t
      )
    );


  const x =
    ax +
    t * dx;

  const y =
    ay +
    t * dy;


  return Math.hypot(
    px - x,
    py - y
  );
}


/* ============================================================
 * AVAILABILITY / SEARCH HELPERS
 * ========================================================== */

function locatorCommunityMatchesArea_(
  community,
  area
) {
  const haystack =
    locatorNormalizeText_(
      [
        community.communityName,
        community.address,
        community.city,
        community.state,
        community.zip,
        community.url
      ].join(
        " "
      )
    );

  return haystack.includes(
    area
  );
}


function locatorAvailabilityRent_(row) {
  if (row === null || row === undefined) return null;

  const MIN_REASONABLE_RENT = 400;

  const parseRentValue = value => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") {
      return Number.isFinite(value) && value >= MIN_REASONABLE_RENT ? value : null;
    }

    const text = String(value).replace(/\u00a0/g, " ").trim();
    const contextual = text.match(
      /(?:starting\s*(?:at|from)|base\s*rent|monthly\s*rent|rent|price|rate)\s*[:=-]?\s*\$?\s*(\d{1,3}(?:,\d{3})+|\d{3,7})(?:\.\d{1,2})?/i
    );
    const currency = text.match(
      /\$\s*(\d{1,3}(?:,\d{3})+|\d{3,7})(?:\.\d{1,2})?/
    );
    const plain = text.match(
      /\b(\d{1,3}(?:,\d{3})+|\d{3,7})(?:\.\d{1,2})?\b/
    );
    const match = contextual || currency || plain;
    if (!match) return null;

    const token = match[0].match(/(\d{1,3}(?:,\d{3})+|\d{3,7})(?:\.\d{1,2})?/);
    if (!token) return null;
    const number = Number(token[0].replace(/,/g, ""));
    return Number.isFinite(number) && number >= MIN_REASONABLE_RENT ? number : null;
  };

  if (typeof row !== "object") return parseRentValue(row);

  const preferredNames = [
    "price", "rent", "baseRent", "startingRent", "startingAt",
    "monthlyRent", "rentAmount", "monthlyRate", "rate", "priceRange", "rentRange"
  ];

  for (const name of preferredNames) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      const parsed = parseRentValue(row[name]);
      if (parsed !== null) return parsed;
    }
  }

  const excludedKey = key =>
    /special|promo|credit|gift|concession|deposit|fee|application|admin|rebate|discount/i.test(key);

  const score = key =>
    (/rent/i.test(key) ? 8 : 0) +
    (/price|rate/i.test(key) ? 6 : 0) +
    (/base|starting|monthly/i.test(key) ? 3 : 0);

  const rentKeys = Object.keys(row)
    .filter(key => !excludedKey(key) && /rent|price|rate|monthly|starting|base/i.test(key))
    .sort((a, b) => score(b) - score(a));

  for (const key of rentKeys) {
    const parsed = parseRentValue(row[key]);
    if (parsed !== null) return parsed;
  }

  if (Object.prototype.hasOwnProperty.call(row, "amount")) {
    const parsed = parseRentValue(row.amount);
    if (parsed !== null) return parsed;
  }

  return null;
}


function locatorAvailabilityIsNow_(
  row
) {
  const text =
    locatorNormalizeText_(
      row &&
      typeof row ===
      "object"
        ? (
            row.availabilityDate ??
            row.availableDate ??
            row.date ??
            row.status ??
            ""
          )
        : row
    );

  return (
    text.includes(
      "available"
    ) &&
    !/\d/.test(
      text
    )
  );
}


function locatorAvailabilityDate_(
  row
) {
  if (
    locatorAvailabilityIsNow_(
      row
    )
  ) {
    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    return today;
  }

  if (
    !row ||
    typeof row !==
    "object"
  ) {
    return locatorParseDate_(
      row
    );
  }

  return locatorParseDate_(
    row.availabilityDate ??
    row.availableDate ??
    row.date ??
    row.moveInDate ??
    ""
  );
}


function locatorParseDate_(
  value
) {
  if (!value) {
    return null;
  }

  if (
    Object.prototype.toString.call(
      value
    ) ===
    "[object Date]" &&
    !isNaN(
      value.getTime()
    )
  ) {
    const copy =
      new Date(
        value
      );

    copy.setHours(
      0,
      0,
      0,
      0
    );

    return copy;
  }

  const text =
    String(
      value
    ).trim();

  if (!text) {
    return null;
  }

  const date =
    new Date(
      text
    );

  if (
    isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  date.setHours(
    0,
    0,
    0,
    0
  );

  return date;
}


/* ============================================================
 * OPERATIONS SHEET SETUP
 * ========================================================== */

function locatorSetupOperationsSheets_() {
  const spreadsheet =
    locatorOperationsDb_();

  locatorEnsureSheet_(
    spreadsheet,
    LOCATOR_SHEETS.GUEST_CARDS,
    [
      "GuestCardID",
      "CommunityIDs",
      "CommunityURLs",
      "FloorplanIDs",
      "ClientName",
      "ClientEmail",
      "ClientPhone",
      "MoveInDate",
      "ToEmail",
      "BccRecipients",
      "Subject",
      "PdfFileName",
      "GmailMessageID",
      "SentAt",
      "Status"
    ]
  );

  locatorEnsureSheet_(
    spreadsheet,
    LOCATOR_SHEETS.TOURS,
    [
      "TourID",
      "CommunityID",
      "CommunityURL",
      "FloorplanID",
      "ClientName",
      "ClientEmail",
      "ClientPhone",
      "TourDate",
      "TourTime",
      "SchedulingURL",
      "Recipient",
      "GmailMessageID",
      "Status",
      "LoggedAt"
    ]
  );

  locatorEnsureSheet_(
    spreadsheet,
    LOCATOR_SHEETS.EMAIL_LOG,
    [
      "EmailLogID",
      "Type",
      "CommunityID",
      "FloorplanID",
      "Recipient",
      "BccRecipients",
      "Subject",
      "SentAt",
      "Status",
      "RelatedGuestCardID",
      "RelatedTourID"
    ]
  );

  locatorEnsureSheet_(spreadsheet, LOCATOR_SHEETS.WEBSITE_LEADS, [
    "SubmissionID","FloorplanID","CommunityID","ClientName","ClientEmail","ClientPhone","MoveInDate",
    "TourDate","TourTime","TourSlot","Source","SMSConsent","GuestCardID","TourID","Status","Message","CreatedAt","UpdatedAt"
  ]);

  locatorEnsureSheet_(spreadsheet, LOCATOR_SHEETS.APPLICATION_FOLLOWUP, [
    "FollowUpID","SubmissionID","FloorplanID","CommunityID","ClientName","ClientEmail","ClientPhone",
    "Applied","ApplicationDate","Outcome","FollowUpDate","FollowUpStatus","Notes","UpdatedAt"
  ]);

  locatorEnsureSheet_(spreadsheet, LOCATOR_SHEETS.PROPERTY_SUPPORT, [
    "CommunityID","FloorplanID","OneApp","TheGuarantors","Jetty","LibertyRent","Rhino","Leap","Insurent","Cosign",
    "AffordableProgram","AffordableAMIPercent","HudEntityID","HudYear","TourProvider","TourURL","TourAvailabilityJSON",
    "SourceURL","VerifiedAt","Notes"
  ]);

  locatorEnsureSheet_(spreadsheet, LOCATOR_SHEETS.MESSAGE_CONTACTS, [
    "ContactID","ClientName","Phone","Email","LeaseEndDate","SMSConsent","SMSConsentAt","SMSConsentSource","OptedOut","Tags","Notes","UpdatedAt"
  ]);

  locatorEnsureSheet_(spreadsheet, LOCATOR_SHEETS.MESSAGE_LOG, [
    "MessageID","ContactID","ClientName","Phone","Body","ProviderMessageID","Status","SentAt","Error"
  ]);

  const defaultSheet =
    spreadsheet.getSheetByName(
      "Sheet1"
    );

  if (
    defaultSheet &&
    spreadsheet.getSheets().length >
      1 &&
    defaultSheet.getLastRow() ===
      0
  ) {
    spreadsheet.deleteSheet(
      defaultSheet
    );
  }
}


function locatorUpgrade() {
  locatorEnsureApartmentWritableColumns_();
  locatorSetupOperationsSheets_();

  return {
    apartmentDatabase:
      locatorApartmentDb_()
        .getName(),

    operationsSpreadsheet:
      locatorOperationsDb_()
        .getName(),

    status:
      "Locator backend upgraded."
  };
}


function locatorRotateApiKey(
  newApiKey
) {
  const key =
    String(
      newApiKey ||
      ""
    ).trim();

  if (
    key.length <
    16
  ) {
    throw new Error(
      "New API key must be at least 16 characters."
    );
  }

  PropertiesService
    .getScriptProperties()
    .setProperty(
      LOCATOR_PROPERTIES.API_KEY,
      key
    );

  return {
    updated:
      true
  };
}


function locatorAppendOperation_(
  sheetName,
  record
) {
  const spreadsheet =
    locatorOperationsDb_();

  const sheet =
    spreadsheet.getSheetByName(
      sheetName
    );

  if (!sheet) {
    throw new Error(
      "Operations sheet is missing: " +
      sheetName
    );
  }

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0];


  const row =
    headers.map(
      header =>
        record[
          header
        ] ??
        ""
    );


  sheet.appendRow(
    row
  );
}


/* ============================================================
 * APARTMENT WRITE-COLUMN SETUP
 * ========================================================== */

function locatorEnsureApartmentWritableColumns_() {
  const sheet =
    locatorApartmentSheet_(
      LOCATOR_SHEETS.COMMUNITIES
    );

  let headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0];


  LOCATOR_ALLOWED_COMMUNITY_WRITE_COLUMNS.forEach(
    header => {

      const exists =
        headers.some(
          value =>
            locatorNormalizeHeader_(
              value
            ) ===
            locatorNormalizeHeader_(
              header
            )
        );

      if (!exists) {

        sheet
          .getRange(
            1,
            sheet.getLastColumn() +
              1
          )
          .setValue(
            header
          );

        headers.push(
          header
        );

      }

    }
  );
}


function locatorWriteAllowedCommunityField_(
  sheet,
  columns,
  rowNumber,
  field,
  value
) {
  if (
    !LOCATOR_ALLOWED_COMMUNITY_WRITE_COLUMNS.includes(
      field
    )
  ) {
    throw new Error(
      "Blocked apartment-database write field: " +
      field
    );
  }

  const index =
    columns[
      locatorNormalizeHeader_(
        field
      )
    ];

  if (
    index ===
    undefined
  ) {
    throw new Error(
      "Permitted community column is missing: " +
      field
    );
  }

  sheet
    .getRange(
      rowNumber,
      index + 1
    )
    .setValue(
      value
    );
}



/* ============================================================
 * SPECIAL / NET-EFFECTIVE RENT
 * ========================================================== */

function locatorParseMoneyFromText_(
  value
) {
  const matches =
    String(
      value ||
      ""
    )
      .match(
        /\$[\d,]+(?:\.\d{1,2})?/g
      ) ||
    [];

  return matches
    .map(
      item =>
        Number(
          item.replace(
            /[$,]/g,
            ""
          )
        )
    )
    .filter(
      Number.isFinite
    );
}


function locatorParseLeaseTermMonths_(value) {
  const text = String(value || "");
  const range = text.match(
    /(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s*(?:months?|mos?)\b/i
  );
  if (range) return Math.min(Number(range[1]), Number(range[2]));

  const patterns = [
    /(?:minimum|min\.?|at\s+least)\s*(?:lease\s*(?:term)?\s*(?:of)?\s*)?(\d{1,2})\s*(?:months?|mos?)\b/i,
    /(?:on|with|for|requires?|must\s+sign|sign(?:ing)?)\s+(?:a\s+)?(\d{1,2})[-\s]*(?:month|months|mo|mos)\b/i,
    /(?:lease|term)\s*(?:of|=|:)?\s*(\d{1,2})\s*(?:months?|mos?)\b/i,
    /(\d{1,2})[-\s]*(?:month|months|mo|mos)\s*(?:lease|term)\b/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return 12;
}


function locatorParseSpecial_(specialText) {
  const raw = String(specialText || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const result = {
    raw,
    type: "none",
    confidence: 0,
    reason: "",
    weeksFree: 0,
    monthsFree: 0,
    monthlyDiscount: 0,
    oneTimeCredit: 0,
    giftCard: 0,
    percentOff: 0,
    leaseTermMonths: 12,
    leaseTermMinMonths: 12,
    leaseTermMaxMonths: 0,
    preferredLeaseTermMonths: 12,
    leaseTermExplicit: false,
    bedRestrictions: [],
    studioExcluded: false,
    selectHomesOnly: false,
    upTo: false,
    needsReview: false,
    assumptions: []
  };

  if (!raw) {
    result.reason = "No special was recorded.";
    result.confidence = 100;
    return result;
  }

  const range = raw.match(
    /(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s*(?:months?|mos?)\b/i
  );
  if (range) {
    result.leaseTermMinMonths = Math.min(Number(range[1]), Number(range[2]));
    result.leaseTermMaxMonths = Math.max(Number(range[1]), Number(range[2]));
    result.preferredLeaseTermMonths = result.leaseTermMinMonths;
    result.leaseTermMonths = result.preferredLeaseTermMonths;
    result.leaseTermExplicit = true;
  } else {
    const plusLease = raw.match(/(\d{1,2})\s*\+\s*(?:months?|mos?)\b/i);
    const explicitLease = raw.match(
      /(?:minimum|min\.?|at\s+least|on|with|for|requires?|must\s+sign|sign(?:ing)?|lease(?:\s+term)?(?:\s+of)?|term(?:\s+of)?)\s*(?:a\s+)?(\d{1,2})[-\s]*(?:month|months|mo|mos)\b/i
    ) || raw.match(/(\d{1,2})[-\s]*(?:month|months|mo|mos)\s*(?:lease|term)\b/i);
    const leaseValue = plusLease ? Number(plusLease[1]) : explicitLease ? Number(explicitLease[1]) : 12;
    result.leaseTermMinMonths = leaseValue;
    result.preferredLeaseTermMonths = leaseValue;
    result.leaseTermMonths = leaseValue;
    result.leaseTermExplicit = Boolean(plusLease || explicitLease);
  }

  const weeksMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:weeks?|wks?)\s*(?:rent\s*)?free/i);
  if (weeksMatch) result.weeksFree = Number(weeksMatch[1]);

  const monthsMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:months?|mos?)\s*(?:rent\s*)?free/i);
  if (monthsMatch) result.monthsFree = Number(monthsMatch[1]);

  const percentMatch = raw.match(/(\d+(?:\.\d+)?)\s*%\s*(?:off|discount)/i);
  if (percentMatch) result.percentOff = Number(percentMatch[1]);

  const money = text => {
    const values = locatorParseMoneyFromText_(text);
    return values.length ? Number(values[0]) : 0;
  };

  const monthlyOffMatch = raw.match(
    /\$[\d,]+(?:\.\d{1,2})?\s*(?:off|discount(?:ed)?)\s*(?:base\s*)?(?:rent)?\s*(?:per\s*month|monthly|each\s*month)/i
  );
  if (monthlyOffMatch) result.monthlyDiscount = money(monthlyOffMatch[0]);

  const creditMatch = raw.match(
    /\$[\d,]+(?:\.\d{1,2})?\s*(?:rent\s*)?(?:credit|concession|move[- ]?in\s*credit|bonus)/i
  );
  const credit = creditMatch ? money(creditMatch[0]) : 0;

  const giftMatch = raw.match(
    /\$[\d,]+(?:\.\d{1,2})?\s*(?:visa\s*)?(?:gift\s*card|giftcard)/i
  );
  result.giftCard = giftMatch ? money(giftMatch[0]) : 0;

  let genericOff = 0;
  if (!monthlyOffMatch) {
    const genericOffMatch = raw.match(/\$[\d,]+(?:\.\d{1,2})?\s*(?:off|discount)\b/i);
    genericOff = genericOffMatch ? money(genericOffMatch[0]) : 0;
  }

  // Browser v0.5 has a one-time-credit field but no separate gift-card field.
  // Put all one-time dollar value here once, while retaining giftCard for display/mobile.
  result.oneTimeCredit = credit + result.giftCard + genericOff;

  const bedMatcher = /(?:(\d)\s*(?:&|and|,)\s*)?(\d)\s*(?:bed|bedroom)s?/ig;
  let bedMatch;
  while ((bedMatch = bedMatcher.exec(raw)) !== null) {
    const add = value => {
      const n = Number(value);
      if (Number.isFinite(n) && !result.bedRestrictions.includes(n)) result.bedRestrictions.push(n);
    };
    if (bedMatch[1]) add(bedMatch[1]);
    add(bedMatch[2]);
  }

  result.studioExcluded = /(?:exclude(?:s|d)?|not\s+valid\s+for|except|excluding)\s+studios?/i.test(raw);
  result.selectHomesOnly = /\bselect(?:ed)?\s+(?:homes?|units?|floorplans?|apartments?)\b/i.test(raw);
  result.upTo = /\bup\s+to\b/i.test(raw);

  const recognized = result.weeksFree > 0 || result.monthsFree > 0 ||
    result.monthlyDiscount > 0 || result.oneTimeCredit > 0 || result.percentOff > 0;
  result.needsReview = result.selectHomesOnly || result.upTo || !recognized;

  if (result.weeksFree > 0 && result.oneTimeCredit > 0) {
    result.type = "weeks_free_plus_credit";
    result.reason = "Free weeks plus a one-time credit, concession or gift card.";
    result.confidence = 95;
  } else if (result.monthsFree > 0 && result.oneTimeCredit > 0) {
    result.type = "months_free_plus_credit";
    result.reason = "Free months plus a one-time credit, concession or gift card.";
    result.confidence = 95;
  } else if (result.weeksFree > 0) {
    result.type = "weeks_free";
    result.reason = "The special explicitly advertises free weeks.";
    result.confidence = 98;
  } else if (result.monthsFree > 0) {
    result.type = "months_free";
    result.reason = "The special explicitly advertises free months.";
    result.confidence = 98;
  } else if (result.monthlyDiscount > 0) {
    result.type = "monthly_base_rent_discount";
    result.reason = "The special explicitly reduces monthly rent.";
    result.confidence = 94;
  } else if (result.percentOff > 0) {
    result.type = "percent_off";
    result.reason = "The special explicitly advertises a percentage discount.";
    result.confidence = 98;
  } else if (result.oneTimeCredit > 0) {
    result.type = "one_time_credit";
    result.reason = "The special appears to be a one-time credit, concession, gift card or dollar-off offer.";
    result.confidence = 92;
  } else {
    result.type = "unknown";
    result.reason = "The special was recorded but did not match a known discount pattern.";
    result.confidence = 25;
  }

  return result;
}


function locatorSpecialMinimumLeaseTermMonths_(interpretation) {
  const parsed = Number(
    interpretation && (
      interpretation.leaseTermMinMonths ||
      interpretation.preferredLeaseTermMonths ||
      interpretation.leaseTermMonths
    )
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
}


function locatorActualLeaseTermMonths_(availabilityRow) {
  const row = availabilityRow && typeof availabilityRow === "object" ? availabilityRow : {};
  const values = [];
  for (const key of Object.keys(row)) {
    if (/lease|term/i.test(key)) values.push(row[key]);
  }
  values.push(row.leaseTerm, row.lease, row.term);

  for (const raw of values) {
    if (raw === null || raw === undefined || raw === "") continue;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
    const match = String(raw).match(/(\d+(?:\.\d+)?)\s*(?:month|months|mo|mos)\b/i);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}


function locatorCalculateNetEffectiveRent_(baseRent, availabilityRow, interpretation) {
  if (!baseRent || !interpretation) {
    return {
      rent: baseRent || null,
      actualLeaseTermMonths: null,
      specialMinimumLeaseTermMonths: 12,
      specialMaximumLeaseTermMonths: 0,
      calculationLeaseTermMonths: 12,
      leaseTermQualified: false,
      warning: ""
    };
  }

  const actualLeaseTermMonths = locatorActualLeaseTermMonths_(availabilityRow);
  const specialMinimumLeaseTermMonths = locatorSpecialMinimumLeaseTermMonths_(interpretation);
  const specialMaximumLeaseTermMonths = Number(interpretation.leaseTermMaxMonths || 0);
  const preferredLeaseTermMonths = Number(
    interpretation.preferredLeaseTermMonths || interpretation.leaseTermMonths || specialMinimumLeaseTermMonths || 12
  );

  const actualMeetsMinimum = actualLeaseTermMonths !== null && actualLeaseTermMonths >= specialMinimumLeaseTermMonths;
  const actualMeetsMaximum = actualLeaseTermMonths === null ||
    !Number.isFinite(specialMaximumLeaseTermMonths) || specialMaximumLeaseTermMonths <= 0 ||
    actualLeaseTermMonths <= specialMaximumLeaseTermMonths;
  const leaseTermQualified = actualLeaseTermMonths !== null
    ? actualMeetsMinimum && actualMeetsMaximum
    : true;

  const calculationLeaseTermMonths = actualLeaseTermMonths !== null && leaseTermQualified
    ? actualLeaseTermMonths
    : (Number.isFinite(preferredLeaseTermMonths) && preferredLeaseTermMonths > 0 ? preferredLeaseTermMonths : 12);

  let warning = "";
  if (actualLeaseTermMonths !== null && !leaseTermQualified) {
    if (actualLeaseTermMonths < specialMinimumLeaseTermMonths) {
      warning = "Actual lease term (" + actualLeaseTermMonths + " months) is below the promotional minimum (" +
        specialMinimumLeaseTermMonths + " months).";
    } else if (specialMaximumLeaseTermMonths > 0 && actualLeaseTermMonths > specialMaximumLeaseTermMonths) {
      warning = "Actual lease term (" + actualLeaseTermMonths + " months) is above the promotional maximum (" +
        specialMaximumLeaseTermMonths + " months).";
    }
  }

  // If availability explicitly gives a term outside the advertised range, do not
  // silently apply the concession to that unit.
  if (actualLeaseTermMonths !== null && !leaseTermQualified) {
    return {
      rent: Number(Number(baseRent).toFixed(2)),
      actualLeaseTermMonths,
      specialMinimumLeaseTermMonths,
      specialMaximumLeaseTermMonths,
      calculationLeaseTermMonths: actualLeaseTermMonths,
      leaseTermQualified: false,
      warning
    };
  }

  let totalDiscount = 0;
  totalDiscount += baseRent * Number(interpretation.monthsFree || 0);

  // Total free-weeks concession, spread across the lease once by the final formula.
  totalDiscount += (baseRent / 4.345) * Number(interpretation.weeksFree || 0);

  totalDiscount += Number(interpretation.oneTimeCredit || 0);
  totalDiscount += Number(interpretation.monthlyDiscount || 0) * calculationLeaseTermMonths;
  totalDiscount += (baseRent * (Number(interpretation.percentOff || 0) / 100)) * calculationLeaseTermMonths;

  const rent = Math.max(
    0,
    (baseRent * calculationLeaseTermMonths - totalDiscount) / calculationLeaseTermMonths
  );

  return {
    rent: Number(rent.toFixed(2)),
    actualLeaseTermMonths,
    specialMinimumLeaseTermMonths,
    specialMaximumLeaseTermMonths,
    calculationLeaseTermMonths,
    leaseTermQualified,
    warning
  };
}


function locatorSpecialSummary_(
  interpretation
) {
  if (
    !interpretation ||
    !interpretation.raw
  ) {
    return "";
  }

  switch (
    interpretation.type
  ) {
    case "weeks_free":
      return (
        interpretation.weeksFree +
        " weeks free, averaged from base rent."
      );

    case "months_free":
      return (
        interpretation.monthsFree +
        " months free, averaged from base rent."
      );

    case "weeks_free_plus_credit":
      return (
        interpretation.weeksFree +
        " weeks free plus $" +
        Number(
          interpretation.oneTimeCredit ||
          0
        ).toLocaleString() +
        " one-time credit."
      );

    case "months_free_plus_credit":
      return (
        interpretation.monthsFree +
        " months free plus $" +
        Number(
          interpretation.oneTimeCredit ||
          0
        ).toLocaleString() +
        " one-time credit."
      );

    case "monthly_base_rent_discount":
      return (
        "$" +
        Number(
          interpretation.monthlyDiscount ||
          0
        ).toLocaleString() +
        " off base rent per month."
      );

    case "percent_off":
      return (
        interpretation.percentOff +
        "% off base rent."
      );

    case "one_time_credit":
      return (
        "$" +
        Number(
          interpretation.oneTimeCredit ||
          0
        ).toLocaleString() +
        " one-time credit/concession."
      );

    default:
      return interpretation.reason ||
        interpretation.raw;
  }
}


function locatorClientFullName_(
  lead
) {
  return [
    String(
      lead?.firstName ||
      ""
    ).trim(),
    String(
      lead?.lastName ||
      ""
    ).trim()
  ]
    .filter(
      Boolean
    )
    .join(
      " "
    )
    .trim();
}


function locatorValidatedSenderAlias_(
  alias
) {
  const wanted =
    String(
      alias ||
      ""
    )
      .trim()
      .toLowerCase();

  if (!wanted) {
    return "";
  }

  const aliases =
    GmailApp
      .getAliases()
      .map(
        value =>
          String(
            value ||
            ""
          )
            .trim()
            .toLowerCase()
      );

  if (
    !aliases.includes(
      wanted
    )
  ) {
    throw new Error(
      "Selected Gmail send-as alias is not available to this Apps Script account."
    );
  }

  return wanted;
}


/* ============================================================
 * LOW-LEVEL HELPERS
 * ========================================================== */

function locatorApartmentDb_() {
  const id =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        LOCATOR_PROPERTIES.APARTMENT_DB_ID
      );

  if (!id) {
    throw new Error(
      "Locator backend is not installed. Run locatorInstall(...) first."
    );
  }

  return SpreadsheetApp.openById(
    id
  );
}


function locatorOperationsDb_() {
  const id =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        LOCATOR_PROPERTIES.OPERATIONS_ID
      );

  if (!id) {
    throw new Error(
      "Operations spreadsheet is not configured."
    );
  }

  return SpreadsheetApp.openById(
    id
  );
}


function locatorApartmentSheet_(
  name
) {
  const sheet =
    locatorApartmentDb_()
      .getSheetByName(
        name
      );

  if (!sheet) {
    throw new Error(
      "Apartment database is missing sheet: " +
      name
    );
  }

  return sheet;
}


function locatorEnsureSheet_(
  spreadsheet,
  name,
  headers
) {
  let sheet =
    spreadsheet.getSheetByName(
      name
    );

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet(
        name
      );
  }

  if (
    sheet.getLastRow() ===
    0
  ) {
    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([
        headers
      ]);

    sheet.setFrozenRows(
      1
    );

    return sheet;
  }

  const existing =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0]
      .map(
        value =>
          String(
            value ||
            ""
          ).trim()
      );

  headers.forEach(
    header => {
      const normalized =
        locatorNormalizeHeader_(
          header
        );

      const found =
        existing.some(
          value =>
            locatorNormalizeHeader_(
              value
            ) ===
            normalized
        );

      if (!found) {
        sheet
          .getRange(
            1,
            sheet.getLastColumn() +
              1
          )
          .setValue(
            header
          );

        existing.push(
          header
        );
      }
    }
  );

  sheet.setFrozenRows(
    1
  );

  return sheet;
}


function locatorParseRequest_(
  e
) {
  const raw =
    e &&
    e.parameter &&
    e.parameter.request
      ? e.parameter.request
      : "";

  if (!raw) {
    throw new Error(
      "Missing request payload."
    );
  }

  return JSON.parse(
    raw
  );
}


function locatorRequireApiKey_(
  provided
) {
  const expected =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        LOCATOR_PROPERTIES.API_KEY
      ) ||
    "";

  if (
    !expected ||
    String(
      provided || ""
    ) !==
    expected
  ) {
    throw new Error(
      "Unauthorized Locator API request."
    );
  }
}


function locatorJson_(
  value
) {
  return ContentService
    .createTextOutput(
      JSON.stringify(
        value
      )
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


function locatorHeaderMap_(
  sheet
) {
  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getValues()[0];

  const map = {};

  headers.forEach(
    (
      header,
      index
    ) => {

      map[
        locatorNormalizeHeader_(
          header
        )
      ] =
        index;

    }
  );

  return map;
}


function locatorSheetObjects_(
  sheet
) {
  const values =
    sheet
      .getDataRange()
      .getValues();

  if (
    values.length <
    2
  ) {
    return [];
  }

  const headers =
    values[0]
      .map(
        value =>
          String(
            value || ""
          ).trim()
      );

  return values
    .slice(
      1
    )
    .map(
      row => {

        const object =
          {};

        headers.forEach(
          (
            header,
            index
          ) => {

            if (header) {
              object[
                header
              ] =
                row[
                  index
                ];
            }

          }
        );

        return object;

      }
    );
}


function locatorPick_(
  object,
  names
) {
  if (
    !object ||
    typeof object !==
    "object"
  ) {
    return "";
  }

  const normalized =
    {};

  Object.keys(
    object
  ).forEach(
    key => {

      normalized[
        locatorNormalizeHeader_(
          key
        )
      ] =
        object[
          key
        ];

    }
  );

  for (
    const name
    of names
  ) {

    const key =
      locatorNormalizeHeader_(
        name
      );

    if (
      normalized[
        key
      ] !==
      undefined
    ) {
      return normalized[
        key
      ];
    }

  }

  return "";
}


function locatorFindRowByColumn_(
  sheet,
  columns,
  columnName,
  wantedValue
) {
  const index =
    columns[
      locatorNormalizeHeader_(
        columnName
      )
    ];

  if (
    index ===
    undefined
  ) {
    throw new Error(
      "Required column is missing: " +
      columnName
    );
  }

  const values =
    sheet
      .getRange(
        2,
        index + 1,
        Math.max(
          0,
          sheet.getLastRow() -
          1
        ),
        1
      )
      .getValues();

  const wanted =
    String(
      wantedValue || ""
    ).trim();

  for (
    let i = 0;
    i <
    values.length;
    i++
  ) {

    if (
      String(
        values[i][0] ||
        ""
      ).trim() ===
      wanted
    ) {
      return i + 2;
    }

  }

  return null;
}


function locatorNormalizeHeader_(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ""
    );
}


function locatorNormalizeText_(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}


function locatorNullableNumber_(
  value
) {
  if (
    value ===
      "" ||
    value ===
      null ||
    value ===
      undefined
  ) {
    return null;
  }

  const match =
    String(
      value
    )
      .replace(
        /,/g,
        ""
      )
      .match(
        /-?\d+(?:\.\d+)?/
      );

  if (!match) {
    return null;
  }

  const number =
    Number(
      match[0]
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}


function locatorNormalizeEmail_(
  value
) {
  const email =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (!email) {
    return "";
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw new Error(
      "Invalid email address: " +
      email
    );
  }

  return email;
}


function locatorCommunityAddressForGeocode_(
  community
) {
  return [
    community.address,
    community.city,
    community.state,
    community.zip
  ]
    .filter(
      Boolean
    )
    .join(
      ", "
    );
}



/* ============================================================
 * PUBLIC WEBSITE + FOLLOW-UP + MESSAGING EXTENSION v0.1
 * Added for the GitHub Pages website. Public website actions do
 * not expose the private Locator API key or apartment contact emails.
 * ========================================================== */

function locatorIsPublicReadAction_(action) {
  return [
    "publicSiteListings",
    "publicSiteFloorplan",
    "publicTourOptions",
    "publicSubmissionStatus",
    "publicAffordableCheck"
  ].indexOf(String(action || "")) >= 0;
}

function locatorIsPublicPostAction_(action) {
  return ["publicSubmitLeadTour"].indexOf(String(action || "")) >= 0;
}

function locatorPublicRequestFromGet_(parameters) {
  const out = {};
  Object.keys(parameters || {}).forEach(function(key) {
    const raw = parameters[key];
    if (["criteria"].indexOf(key) >= 0) {
      try { out[key] = JSON.parse(raw || "{}"); }
      catch (_) { out[key] = {}; }
    }
    else { out[key] = raw; }
  });
  return out;
}

function locatorPublicOutput_(payload, callback) {
  const cb = String(callback || "").trim();
  if (cb) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$\.]{0,120}$/.test(cb)) throw new Error("Invalid callback name.");
    return ContentService.createTextOutput(cb + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return locatorJson_(payload);
}

function locatorDispatchPublicAction_(action, request) {
  switch (action) {
    case "publicSiteListings": return locatorPublicSiteListings_(request.criteria || {});
    case "publicSiteFloorplan": return locatorPublicSiteFloorplan_(request.floorplanId);
    case "publicTourOptions": return locatorPublicTourOptions_(request.floorplanId);
    case "publicSubmissionStatus": return locatorPublicSubmissionStatus_(request.submissionId);
    case "publicAffordableCheck": return locatorPublicAffordableCheck_(request);
    case "publicSubmitLeadTour": return locatorPublicSubmitLeadTour_(request);
    default: throw new Error("Unknown public action.");
  }
}

function locatorPublicSiteListings_(criteria) {
  criteria = Object.assign({ availableOnly: false }, criteria || {});
  const raw = locatorSearchApartments_(criteria);
  const communities = {};
  locatorReadCommunities_().forEach(function(c){ communities[c.communityId] = c; });
  const media = locatorPublicMediaIndex_();
  const support = locatorPropertySupportIndex_();
  return {
    results: (raw.results || []).map(function(item){
      return locatorPublicListingView_(item, communities[item.communityId], media, support);
    })
  };
}

function locatorPublicSiteFloorplan_(floorplanId) {
  const item = locatorGetFloorplan_(floorplanId);
  const community = locatorGetCommunity_(item.communityId);
  return locatorPublicListingView_(item, community, locatorPublicMediaIndex_(), locatorPropertySupportIndex_());
}

function locatorPublicListingView_(item, community, media, supportIndex) {
  const fpKey = String(item.floorplanId || "");
  const cmKey = String(item.communityId || "");
  const support = supportIndex[fpKey] || supportIndex[cmKey] || {};
  return {
    floorplanId: fpKey,
    communityId: cmKey,
    communityName: String((community && community.communityName) || ""),
    floorplanName: item.floorplanName,
    beds: item.beds,
    baths: item.baths,
    sqft: item.sqft,
    baseRent: item.baseRent,
    netEffectiveRent: item.netEffectiveRent,
    specialText: item.specialText,
    specialSummary: item.specialSummary,
    availabilityCount: item.availabilityCount,
    availableNow: item.availableNow,
    earliestAvailabilityDate: item.earliestAvailabilityDate,
    city: item.city,
    state: item.state,
    zip: item.zip,
    images: (media.floorplans[fpKey] || media.communities[cmKey] || []).slice(0, 12),
    support: locatorPublicSupportView_(support)
  };
}

function locatorPublicMediaIndex_() {
  const out = { floorplans: {}, communities: {} };
  const fpSheet = locatorApartmentSheet_(LOCATOR_SHEETS.FLOORPLANS);
  locatorSheetObjects_(fpSheet).forEach(function(row){
    const id = String(locatorPick_(row,["FloorplanID"]) || "").trim();
    if (id) out.floorplans[id] = locatorExtractMediaUrlsFromRow_(row);
  });
  const cSheet = locatorApartmentSheet_(LOCATOR_SHEETS.COMMUNITIES);
  locatorSheetObjects_(cSheet).forEach(function(row){
    const id = String(locatorPick_(row,["CommunityID"]) || "").trim();
    if (id) out.communities[id] = locatorExtractMediaUrlsFromRow_(row);
  });
  return out;
}

function locatorExtractMediaUrlsFromRow_(row) {
  const urls = [];
  Object.keys(row || {}).forEach(function(key){
    if (!/(image|photo|media)/i.test(key)) return;
    locatorCollectUrls_(row[key], urls, 0);
  });
  return Array.from(new Set(urls)).slice(0, 20);
}

function locatorCollectUrls_(value, urls, depth) {
  if (depth > 4 || value === null || value === undefined) return;
  if (Array.isArray(value)) { value.forEach(function(v){ locatorCollectUrls_(v, urls, depth + 1); }); return; }
  if (typeof value === "object") { Object.keys(value).forEach(function(k){ locatorCollectUrls_(value[k], urls, depth + 1); }); return; }
  const text = String(value || "").trim();
  if (!text) return;
  if ((text[0] === "[" || text[0] === "{") && depth < 3) {
    try { locatorCollectUrls_(JSON.parse(text), urls, depth + 1); return; } catch (_) {}
  }
  const matches = text.match(/https?:\/\/[^\s"'<>\],}]+/g) || [];
  matches.forEach(function(url){ if (/^https:\/\//i.test(url)) urls.push(url); });
}

function locatorPropertySupportIndex_() {
  const sheet = locatorOperationsDb_().getSheetByName(LOCATOR_SHEETS.PROPERTY_SUPPORT);
  const out = {};
  if (!sheet || sheet.getLastRow() < 2) return out;
  const rows = locatorSheetObjects_(sheet);
  // Community rows establish defaults.
  rows.forEach(function(row){
    const fp = String(locatorPick_(row,["FloorplanID"]) || "").trim();
    const cm = String(locatorPick_(row,["CommunityID"]) || "").trim();
    if (cm && !fp) out[cm] = Object.assign({}, out[cm] || {}, row);
  });
  // Floorplan rows override those defaults only for that floorplan.
  rows.forEach(function(row){
    const fp = String(locatorPick_(row,["FloorplanID"]) || "").trim();
    const cm = String(locatorPick_(row,["CommunityID"]) || "").trim();
    if (fp) out[fp] = Object.assign({}, (cm && out[cm]) || {}, row);
  });
  return out;
}

function locatorPublicSupportView_(row) {
  row = row || {};
  return {
    oneApp: locatorTruthy_(locatorPick_(row,["OneApp"])),
    theGuarantors: locatorTruthy_(locatorPick_(row,["TheGuarantors"])),
    jetty: locatorTruthy_(locatorPick_(row,["Jetty"])),
    libertyRent: locatorTruthy_(locatorPick_(row,["LibertyRent"])),
    rhino: locatorTruthy_(locatorPick_(row,["Rhino"])),
    leap: locatorTruthy_(locatorPick_(row,["Leap"])),
    insurent: locatorTruthy_(locatorPick_(row,["Insurent"])),
    cosign: locatorTruthy_(locatorPick_(row,["Cosign"])),
    affordableProgram: String(locatorPick_(row,["AffordableProgram"]) || "").trim(),
    affordableAmiPercent: locatorNullableNumber_(locatorPick_(row,["AffordableAMIPercent"])),
    verifiedAt: String(locatorPick_(row,["VerifiedAt"]) || "").trim(),
    sourceUrl: String(locatorPick_(row,["SourceURL"]) || "").trim(),
    notes: String(locatorPick_(row,["Notes"]) || "").trim()
  };
}

function locatorTruthy_(value) {
  if (value === true) return true;
  return /^(1|true|yes|y|verified|accepted)$/i.test(String(value || "").trim());
}

function locatorPublicTourOptions_(floorplanId) {
  const fp = locatorGetFloorplan_(floorplanId);
  const community = locatorGetCommunity_(fp.communityId);
  const supportIndex = locatorPropertySupportIndex_();
  const row = supportIndex[String(fp.floorplanId)] || supportIndex[String(fp.communityId)] || {};
  let slots = [];
  const raw = locatorPick_(row,["TourAvailabilityJSON"]);
  if (raw) { try { slots = Array.isArray(raw) ? raw : JSON.parse(String(raw)); } catch (_) { slots = []; } }
  if (!Array.isArray(slots)) slots = [];
  return {
    floorplanId: fp.floorplanId,
    provider: String(locatorPick_(row,["TourProvider"]) || "email").trim() || "email",
    tourUrl: String(locatorPick_(row,["TourURL"]) || community.tourUrl || "").trim(),
    slots: slots.slice(0, 80),
    slotSource: slots.length ? "verified-or-cached-property-scheduler" : "preferred-time-request"
  };
}

function locatorPublicSubmitLeadTour_(request) {
  request = request || {};
  if (String(request.website || "").trim()) throw new Error("Spam check failed.");
  const submittedAt = Number(request.submittedAt || 0);
  if (submittedAt && Date.now() - submittedAt < 700) throw new Error("Please complete the form before submitting.");
  const submissionId = String(request.submissionId || ("WEB-" + Utilities.getUuid())).trim();
  const lead = request.lead || {};
  const tour = request.tour || {};
  const first = String(lead.firstName || "").trim();
  const last = String(lead.lastName || "").trim();
  const email = locatorNormalizeEmail_(lead.email);
  const phone = String(lead.phone || "").replace(/[^0-9+]/g, "").trim();
  if (!first || !last || !email || phone.replace(/\D/g,"").length < 10) throw new Error("Name, valid email and phone are required.");
  if (!String(tour.tourDate || "").trim() || !String(tour.tourTime || "").trim()) throw new Error("Preferred tour date and time are required.");
  const floorplan = locatorGetFloorplan_(request.floorplanId);
  const community = locatorGetCommunity_(floorplan.communityId);
  const cache = CacheService.getScriptCache();
  const dedupeKey = "websiteLead:" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, [email,phone,floorplan.floorplanId,tour.tourDate,tour.tourTime].join("|"))).slice(0,40);
  if (cache.get(dedupeKey)) return { submissionId: submissionId, status: "DuplicateSuppressed" };
  cache.put(dedupeKey,"1",600);

  const created = new Date();
  locatorUpsertOperationByKey_(LOCATOR_SHEETS.WEBSITE_LEADS,"SubmissionID",submissionId,{
    SubmissionID:submissionId, FloorplanID:floorplan.floorplanId, CommunityID:community.communityId,
    ClientName:(first+" "+last).trim(), ClientEmail:email, ClientPhone:phone, MoveInDate:String(lead.moveIn||""),
    TourDate:String(tour.tourDate||""), TourTime:String(tour.tourTime||""), TourSlot:String(tour.tourSlot||""),
    Source:String(request.source||"website"), SMSConsent:Boolean(lead.smsConsent), Status:"Processing", CreatedAt:created, UpdatedAt:created
  });

  // Keep one reusable client contact record by phone. Marketing SMS consent is optional and is
  // not required to request a tour. Consent is recorded only when the visitor explicitly checks it.
  try {
    locatorUpsertMessageContactByPhone_({
      clientName:(first+" "+last).trim(), phone:phone, email:email,
      smsConsent:Boolean(lead.smsConsent), smsConsentAt:lead.smsConsent ? created : "",
      smsConsentSource:lead.smsConsent ? "website-tour-form" : "", optedOut:false,
      tags:"website-lead", notes:"Interested in "+floorplan.floorplanId
    });
  } catch (_) {}

  let guestCardId="", tourId="", messages=[];
  try {
    const guest = locatorSendGuestCard_({ lead: Object.assign({},lead,{firstName:first,lastName:last,email:email,phone:phone}), targets:[{communityId:community.communityId,floorplanId:floorplan.floorplanId}], message:"Website guest card / tour inquiry." });
    guestCardId = guest.guestCardId || "";
  } catch (error) { messages.push("Guest card: " + (error.message || error)); }
  try {
    const tours = locatorSendTourRequests_({ lead:Object.assign({},lead,{firstName:first,lastName:last,email:email,phone:phone}), requests:[{communityId:community.communityId,floorplanId:floorplan.floorplanId,tourDate:String(tour.tourDate||""),tourTime:String(tour.tourTime||""),note:[String(tour.tourSlot||""),String(tour.note||"")].filter(Boolean).join(" | ")}] });
    tourId = tours.results && tours.results[0] ? String(tours.results[0].tourId || "") : "";
  } catch (error) { messages.push("Tour request: " + (error.message || error)); }

  const status = (guestCardId && tourId) ? "Completed" : "NeedsFollowUp";
  locatorUpsertOperationByKey_(LOCATOR_SHEETS.WEBSITE_LEADS,"SubmissionID",submissionId,{
    GuestCardID:guestCardId, TourID:tourId, Status:status, Message:messages.join(" | "), UpdatedAt:new Date()
  });
  return {submissionId:submissionId,status:status,guestCardId:guestCardId,tourId:tourId,message:messages.join(" | ")};
}

function locatorPublicSubmissionStatus_(submissionId) {
  const id = String(submissionId || "").trim();
  if (!id) return { found:false };
  const sheet = locatorOperationsDb_().getSheetByName(LOCATOR_SHEETS.WEBSITE_LEADS);
  if (!sheet || sheet.getLastRow() < 2) return { found:false };
  const rows = locatorSheetObjects_(sheet);
  const row = rows.find(function(r){ return String(locatorPick_(r,["SubmissionID"]) || "").trim() === id; });
  if (!row) return {found:false};
  return { found:true, submissionId:id, status:String(locatorPick_(row,["Status"])||""), message:String(locatorPick_(row,["Message"])||"") };
}

function locatorUpsertOperationByKey_(sheetName, keyHeader, keyValue, patch) {
  const sheet = locatorOperationsDb_().getSheetByName(sheetName);
  if (!sheet) throw new Error("Operations sheet is missing: " + sheetName);
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const keyCol = headers.indexOf(keyHeader);
  if (keyCol < 0) throw new Error("Missing key column: " + keyHeader);
  let rowNumber = 0;
  if (sheet.getLastRow() >= 2) {
    const values = sheet.getRange(2,keyCol+1,sheet.getLastRow()-1,1).getValues();
    for (let i=0;i<values.length;i++) if (String(values[i][0]||"") === String(keyValue||"")) { rowNumber=i+2; break; }
  }
  if (!rowNumber) {
    const record = Object.assign({},patch); record[keyHeader]=keyValue; locatorAppendOperation_(sheetName,record); return;
  }
  Object.keys(patch||{}).forEach(function(key){ const c=headers.indexOf(key); if(c>=0) sheet.getRange(rowNumber,c+1).setValue(patch[key]); });
}

function locatorListApplicationFollowUps_() {
  const sheet=locatorOperationsDb_().getSheetByName(LOCATOR_SHEETS.APPLICATION_FOLLOWUP);
  return {followUps:sheet&&sheet.getLastRow()>=2?locatorSheetObjects_(sheet):[]};
}

function locatorUpsertApplicationFollowUp_(f) {
  f=f||{}; const id=String(f.followUpId||("APP-"+Utilities.getUuid())).trim();
  locatorUpsertOperationByKey_(LOCATOR_SHEETS.APPLICATION_FOLLOWUP,"FollowUpID",id,{
    FollowUpID:id,SubmissionID:String(f.submissionId||""),FloorplanID:String(f.floorplanId||""),CommunityID:String(f.communityId||""),
    ClientName:String(f.clientName||""),ClientEmail:String(f.clientEmail||""),ClientPhone:String(f.clientPhone||""),
    Applied:Boolean(f.applied),ApplicationDate:String(f.applicationDate||""),Outcome:String(f.outcome||""),FollowUpDate:String(f.followUpDate||""),
    FollowUpStatus:String(f.followUpStatus||"Open"),Notes:String(f.notes||""),UpdatedAt:new Date()
  });
  return {followUpId:id};
}

function locatorConfigureHudApiToken(token) {
  token=String(token||"").trim(); if(!token) throw new Error("HUD API token is required.");
  PropertiesService.getScriptProperties().setProperty(LOCATOR_PROPERTIES.HUD_API_TOKEN,token); return {configured:true};
}

function locatorPublicAffordableCheck_(request) {
  const fp=locatorGetFloorplan_(request.floorplanId); const support=locatorPropertySupportIndex_()[String(fp.floorplanId)]||locatorPropertySupportIndex_()[String(fp.communityId)]||{};
  const entityId=String(locatorPick_(support,["HudEntityID"])||"").trim(); const percent=Math.round(Number(locatorPick_(support,["AffordableAMIPercent"])||0));
  if(!entityId||![20,30,40,50,60,70,80].includes(percent)) throw new Error("This property does not yet have a verified HUD entity + AMI percentage in PropertySupport.");
  const size=Math.max(1,Math.min(8,Number(request.householdSize||1))); const income=Number(request.annualIncome||0); if(!Number.isFinite(income)||income<0) throw new Error("Enter annual household income.");
  const token=String(PropertiesService.getScriptProperties().getProperty(LOCATOR_PROPERTIES.HUD_API_TOKEN)||"").trim(); if(!token) throw new Error("HUD API token is not configured in Apps Script.");
  const requestedYear=String(locatorPick_(support,["HudYear"])||"").trim();
  const url="https://www.huduser.gov/hudapi/public/mtspil/data/"+encodeURIComponent(entityId)+(requestedYear?("?year="+encodeURIComponent(requestedYear)):"");
  const response=UrlFetchApp.fetch(url,{headers:{Authorization:"Bearer "+token,Accept:"application/json"},muteHttpExceptions:true}); if(response.getResponseCode()!==200) throw new Error("HUD API lookup failed: HTTP "+response.getResponseCode());
  const payload=JSON.parse(response.getContentText()); const data=payload.data||{}; const bucket=data[String(percent)+"percent"]||{}; const limit=Number(bucket["il"+percent+"_p"+size]||0); if(!limit) throw new Error("HUD did not return the expected household-size limit.");
  const appears=income<=limit; return {floorplanId:fp.floorplanId,year:data.year||requestedYear||"latest",amiPercent:percent,householdSize:size,annualIncome:income,incomeLimit:limit,appearsWithinLimit:appears,summary:appears?"Income appears within the recorded "+percent+"% AMI limit.":"Income appears above the recorded "+percent+"% AMI limit.",detail:"HUD income-limit comparison only; the property must verify final program eligibility."};
}

function locatorConfigureTwilio(accountSid, authToken, fromNumber) {
  const p=PropertiesService.getScriptProperties();
  p.setProperties({[LOCATOR_PROPERTIES.TWILIO_ACCOUNT_SID]:String(accountSid||"").trim(),[LOCATOR_PROPERTIES.TWILIO_AUTH_TOKEN]:String(authToken||"").trim(),[LOCATOR_PROPERTIES.TWILIO_FROM_NUMBER]:String(fromNumber||"").trim()});
  return {configured:true};
}

function locatorListMessageContacts_() {
  const sheet=locatorOperationsDb_().getSheetByName(LOCATOR_SHEETS.MESSAGE_CONTACTS); if(!sheet||sheet.getLastRow()<2)return {contacts:[]};
  return {contacts:locatorSheetObjects_(sheet).map(function(r){return {
    contactId:String(locatorPick_(r,["ContactID"])||""),clientName:String(locatorPick_(r,["ClientName"])||""),
    phone:String(locatorPick_(r,["Phone"])||""),email:String(locatorPick_(r,["Email"])||""),
    leaseEndDate:locatorDateCellIso_(locatorPick_(r,["LeaseEndDate"])),
    smsConsent:locatorTruthy_(locatorPick_(r,["SMSConsent"])),
    smsConsentAt:String(locatorPick_(r,["SMSConsentAt"])||""),
    smsConsentSource:String(locatorPick_(r,["SMSConsentSource"])||""),
    optedOut:locatorTruthy_(locatorPick_(r,["OptedOut"])),tags:String(locatorPick_(r,["Tags"])||""),notes:String(locatorPick_(r,["Notes"])||"")
  };})};
}

function locatorDateCellIso_(v){if(v instanceof Date)return Utilities.formatDate(v,Session.getScriptTimeZone(),"yyyy-MM-dd");return String(v||"").slice(0,10);}

function locatorUpsertMessageContact_(c) {
  c=c||{}; const id=String(c.contactId||("CONTACT-"+Utilities.getUuid())).trim(); const phone=String(c.phone||"").replace(/[^0-9+]/g,""); if(phone.replace(/\D/g,"").length<10)throw new Error("Valid phone is required.");
  locatorUpsertOperationByKey_(LOCATOR_SHEETS.MESSAGE_CONTACTS,"ContactID",id,{
    ContactID:id,ClientName:String(c.clientName||""),Phone:phone,Email:String(c.email||""),LeaseEndDate:String(c.leaseEndDate||""),
    SMSConsent:Boolean(c.smsConsent),SMSConsentAt:c.smsConsentAt||"",SMSConsentSource:String(c.smsConsentSource||""),OptedOut:Boolean(c.optedOut),
    Tags:String(c.tags||""),Notes:String(c.notes||""),UpdatedAt:new Date()
  }); return {contactId:id};
}

function locatorUpsertMessageContactByPhone_(c) {
  c=c||{}; const phone=String(c.phone||"").replace(/[^0-9+]/g,"");
  const sheet=locatorOperationsDb_().getSheetByName(LOCATOR_SHEETS.MESSAGE_CONTACTS);
  let existing=null;
  if(sheet&&sheet.getLastRow()>=2){existing=locatorSheetObjects_(sheet).find(function(r){return String(locatorPick_(r,["Phone"])||"").replace(/[^0-9+]/g,"")===phone;})||null;}
  const existingId=existing?String(locatorPick_(existing,["ContactID"])||""):"";
  const existingConsent=existing?locatorTruthy_(locatorPick_(existing,["SMSConsent"])):false;
  const existingOptOut=existing?locatorTruthy_(locatorPick_(existing,["OptedOut"])):false;
  return locatorUpsertMessageContact_({
    contactId:existingId,clientName:c.clientName,phone:phone,email:c.email,leaseEndDate:c.leaseEndDate||locatorPick_(existing||{},["LeaseEndDate"]),
    smsConsent:existingOptOut?false:(existingConsent||Boolean(c.smsConsent)),
    smsConsentAt:(existingConsent?locatorPick_(existing||{},["SMSConsentAt"]):(c.smsConsentAt||"")),
    smsConsentSource:(existingConsent?locatorPick_(existing||{},["SMSConsentSource"]):(c.smsConsentSource||"")),
    optedOut:existingOptOut||Boolean(c.optedOut),
    tags:[String(locatorPick_(existing||{},["Tags"])||""),String(c.tags||"")].filter(Boolean).join(", "),
    notes:[String(locatorPick_(existing||{},["Notes"])||""),String(c.notes||"")].filter(Boolean).join(" | ")
  });
}

function locatorSendSmsBatch_(request) {
  const ids=Array.isArray(request.contactIds)?request.contactIds.map(String):[]; const template=String(request.template||"").trim(); if(!ids.length||!template)throw new Error("Contact IDs and template are required.");
  const all=locatorListMessageContacts_().contacts; let sent=0,skipped=0; const results=[];
  ids.forEach(function(id){const c=all.find(function(x){return x.contactId===id}); if(!c||!c.smsConsent||c.optedOut){skipped++;return;} const body=locatorMessageTemplate_(template,c); try{const r=locatorTwilioSend_(c.phone,body);locatorAppendOperation_(LOCATOR_SHEETS.MESSAGE_LOG,{MessageID:"MSG-"+Utilities.getUuid(),ContactID:c.contactId,ClientName:c.clientName,Phone:c.phone,Body:body,ProviderMessageID:r.sid||"",Status:"Sent",SentAt:new Date(),Error:""});sent++;results.push({contactId:c.contactId,status:"Sent"});}catch(error){locatorAppendOperation_(LOCATOR_SHEETS.MESSAGE_LOG,{MessageID:"MSG-"+Utilities.getUuid(),ContactID:c.contactId,ClientName:c.clientName,Phone:c.phone,Body:body,ProviderMessageID:"",Status:"Failed",SentAt:new Date(),Error:error.message||String(error)});results.push({contactId:c.contactId,status:"Failed",error:error.message||String(error)});}});
  return {sentCount:sent,skippedCount:skipped,results:results};
}

function locatorMessageTemplate_(template,c){const first=String(c.clientName||"").trim().split(/\s+/)[0]||"there";return String(template||"").replace(/{{firstName}}/g,first).replace(/{{clientName}}/g,String(c.clientName||"")).replace(/{{leaseEndDate}}/g,String(c.leaseEndDate||"")).replace(/{{phone}}/g,String(c.phone||""));}

function locatorTwilioSend_(to,body){
  const p=PropertiesService.getScriptProperties(); const sid=String(p.getProperty(LOCATOR_PROPERTIES.TWILIO_ACCOUNT_SID)||""); const token=String(p.getProperty(LOCATOR_PROPERTIES.TWILIO_AUTH_TOKEN)||""); const from=String(p.getProperty(LOCATOR_PROPERTIES.TWILIO_FROM_NUMBER)||""); if(!sid||!token||!from)throw new Error("Twilio is not configured in Apps Script.");
  const url="https://api.twilio.com/2010-04-01/Accounts/"+encodeURIComponent(sid)+"/Messages.json"; const auth=Utilities.base64Encode(sid+":"+token); const response=UrlFetchApp.fetch(url,{method:"post",headers:{Authorization:"Basic "+auth},payload:{To:to,From:from,Body:body},muteHttpExceptions:true}); const text=response.getContentText(); let payload={};try{payload=JSON.parse(text)}catch(_){} if(response.getResponseCode()<200||response.getResponseCode()>=300)throw new Error(payload.message||("Twilio HTTP "+response.getResponseCode())); return payload;
}


/* ============================================================
 * MOBILE ADMIN HTML-SERVICE BRIDGE
 * The HTML page is served by this same Apps Script deployment and
 * calls this function with google.script.run, avoiding cross-origin
 * browser restrictions. Every operation still requires the Locator API key.
 * ========================================================== */
function locatorAdminWebAction(apiKey, request) {
  locatorRequireApiKey_(apiKey);
  request=request||{};
  const action=String(request.action||"").trim();
  switch(action){
    case "locatorListMessageContacts": return locatorListMessageContacts_();
    case "locatorUpsertMessageContact": return locatorUpsertMessageContact_(request.contact||{});
    case "locatorSendSmsBatch": return locatorSendSmsBatch_(request);
    case "locatorListApplicationFollowUps": return locatorListApplicationFollowUps_();
    case "locatorUpsertApplicationFollowUp": return locatorUpsertApplicationFollowUp_(request.followUp||{});
    default: throw new Error("Unsupported mobile admin action: "+action);
  }
}
