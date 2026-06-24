/**
 * Spiralpalooza Mailer — standalone Apps Script microservice.
 *
 * Owned + deployed by childrenfirstmail@gmail.com, "Execute as: Me",
 * "Who has access: Anyone". Its only job is to send mail, so every confirmation
 * goes out from the Children First address regardless of which data script called it.
 *
 * The data scripts (rsvp / shirts / volunteer) call this server-to-server via
 * UrlFetchApp, passing a shared secret.
 *
 * Script Properties:
 *   MAIL_SECRET — shared secret; must match the secret each data script sends
 */

function doPost(e) {
  var out = ContentService.createTextOutput();
  try {
    var body = JSON.parse(e.postData.contents);

    // Shared secret is the only thing between this and an open spam relay.
    var expected = PropertiesService.getScriptProperties().getProperty('MAIL_SECRET');
    if (!expected || body.secret !== expected) {
      return out.setContent(JSON.stringify({ ok: false, error: 'forbidden' }));
    }

    // Basic sanity so a leaked secret can't be used to blast arbitrary junk.
    if (!body.to || body.to.indexOf('@') === -1 || !body.subject || !body.htmlBody) {
      return out.setContent(JSON.stringify({ ok: false, error: 'bad request' }));
    }

    MailApp.sendEmail({
      to: body.to,
      subject: body.subject,
      htmlBody: body.htmlBody,
      name: 'Spiralpalooza',                 // friendly display name
      replyTo: 'childrenfirstmail@gmail.com' // replies land in the Children First inbox
    });

    return out.setContent(JSON.stringify({ ok: true }));
  } catch (err) {
    return out.setContent(JSON.stringify({ ok: false, error: String(err) }));
  }
}
