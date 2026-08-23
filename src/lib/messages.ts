import type { Locale } from '@/lib/locale';

const en = {
  'language.label': 'Language',

  'nav.how': 'How it works',
  'nav.why': 'Why',
  'nav.faq': 'FAQ',
  'nav.handbook': 'Handbook',
  'nav.login': 'Log in',
  'nav.legal': 'Legal & Privacy',

  'aria.primary': 'Primary',
  'aria.menu': 'Menu',
  'aria.footer': 'Footer',
  'aria.github': 'GitHub',
  'aria.handbookSections': 'Handbook sections',

  'home.headline1': 'Direct human-to-human gifts',
  'home.headline2': 'over Bitcoin Lightning',
  'home.lead':
    'Ask for help, or send help, without an organization in the middle. Funds flow donor to receiver directly — the platform never custodies a satoshi.',
  'home.ctaAsk': 'Ask for help',
  'home.ctaSend': 'Send help',
  'home.howKicker': 'How it works',
  'home.howTitle': 'Three steps, no accounts in the traditional sense',
  'home.howLead':
    '21.gifts uses LNURL-auth: you sign in with the Lightning wallet you already have. There are no usernames, no passwords, and no email sign-ups.',
  'home.step1Title': 'Sign in with your wallet',
  'home.step1Body':
    'Scan a QR or open Wallet of Satoshi. Your wallet signs a one-time challenge. That signature is your account — nothing else to remember.',
  'home.step2Title': 'Add a Lightning Address',
  'home.step2BodyBefore': 'Link where gifts should land, in the usual',
  'home.step2BodyAfter': 'form. Anyone can then send to you from their own wallet.',
  'home.step3Title': 'Gifts arrive directly',
  'home.step3Body':
    'Donors pay your Lightning Address. Satoshis land in your wallet, not ours. The platform never sees the money.',
  'home.whyKicker': 'Why this exists',
  'home.whyTitle': 'The shortest possible path from one person to another',
  'home.why1Title': 'Truly peer-to-peer',
  'home.why1Body':
    "Funds move from the donor's Lightning wallet to the receiver's Lightning Address. 21.gifts never holds, routes, or escrows the money. There is nothing for us to freeze.",
  'home.why2Title': 'Your wallet is the login',
  'home.why2Body':
    'Identity is the key your Lightning wallet already holds for this site. 21.gifts never sees that key — only a signed challenge. No password database to leak.',
  'home.why3Title': 'Open Lightning rails',
  'home.why3Body':
    'Gifts use Lightning Addresses and invoices that any compatible wallet can pay. If 21.gifts disappeared tomorrow, those addresses would still work.',
  'home.why4Title': 'Non-profit by design',
  'home.why4Body':
    'There is no take-rate, no platform fee, and no fundraising round to recoup. The project covers its own infrastructure cost and nothing more.',
  'home.faqKicker': 'FAQ',
  'home.faqTitle': 'Common questions, answered briefly',
  'home.faq1Q': 'Who can use this?',
  'home.faq1A':
    'Anyone with a Lightning wallet that supports LNURL-auth (Wallet of Satoshi, Phoenix, Alby, Zeus, and others) and a Lightning Address to receive. No application, no review process.',
  'home.faq2Q': 'Do you take a cut of the gifts?',
  'home.faq2A':
    "No. Payments go directly from the donor's wallet to the receiver's Lightning Address. 21.gifts is never in the payment path and earns nothing per transaction.",
  'home.faq3Q': 'What happens to my keys?',
  'home.faq3A':
    'They stay in your Lightning wallet. 21.gifts only sees a signed login challenge and, if you choose, the Lightning Address you publish. There is no password and no seed stored on our servers.',
  'home.faq4Q': 'Can I lose access to my account?',
  'home.faq4A':
    'Yes. If you lose the wallet (or it issues a new LNURL-auth key), the account cannot be recovered in v1. Keep a backup of the wallet you sign in with.',
  'home.faq5Q': 'How do I send a gift?',
  'home.faq5A':
    "Open Send help, enter the recipient's Lightning Address and an amount in sats, then pay the invoice from any Lightning wallet. You do not need to log in to give.",
  'home.faq6Q': 'Why only Bitcoin Lightning?',
  'home.faq6A':
    'Lightning is the only payment rail that is fast, low-fee, censorship-resistant, and works with simple addresses like email. It removes the need for any custodial layer and lets anyone in the world give or receive without permission.',
  'home.faq7Q': 'Is this regulated, and how do taxes work?',
  'home.faq7A':
    '21.gifts is a non-profit communication and discovery layer. It is not a payment service provider and does not move funds. Donors and receivers are responsible for their own tax treatment in their jurisdiction.',

  'notFound.body': 'This page does not exist.',
  'notFound.back': 'Back home',

  'handbook.title': 'Handbook',
  'handbook.introBefore':
    'This is the 21.gifts app handbook: screens, functions, and HTTP endpoints. The api handbook lives in',
  'handbook.introAfter': '.',

  'login.pageTitle': 'Log in to 21.gifts',
  'login.heading': 'Sign in to 21.gifts',
  'login.start': 'Log in with your Lightning wallet',
  'login.preparing': 'Preparing your login…',
  'login.scan': 'Scan to log in',
  'login.openWos': 'Open Wallet of Satoshi',
  'login.expired': 'Login expired',
  'login.error': 'Something went wrong. Please try again.',
  'login.retry': 'Try again',
  'login.signedIn': 'Signed in',
  'login.logOut': 'Log out',
  'login.qrLabel': 'Lightning login QR code',

  'la.heading': 'Lightning Address',
  'la.prompt': 'Link a Lightning Address so gifts can reach you.',
  'la.save': 'Save',
  'la.link': 'Link address',
  'la.cancel': 'Cancel',
  'la.edit': 'Edit',
  'la.unlink': 'Unlink',
  'la.aria': 'Lightning Address',

  'donate.pageTitle': 'Send a gift',
  'donate.heading': 'Pay with Lightning',
  'donate.lead': 'Pay a Lightning Address from your wallet. No account needed.',
  'donate.addressLabel': 'Lightning Address',
  'donate.amountLabel': 'Amount (sats)',
  'donate.create': 'Create invoice',
  'donate.cancel': 'Cancel',
  'donate.openWallet': 'Open in wallet',
  'donate.invoiceQr': 'Lightning invoice QR code',
  'donate.errorAddress': 'Enter a Lightning Address',
  'donate.errorAmount': 'Enter a whole number of sats greater than zero',
  'donate.range': 'This address accepts {min} – {max}.',
  'donate.pay': 'Pay {amount} to {address}',
  'donate.satOne': '1 sat',
  'donate.sats': '{n} sats',
} as const;

/** Flat dotted catalog key shared by every locale. */
export type MessageKey = keyof typeof en;

/** String catalog for one locale (every {@link MessageKey} present). */
export type Messages = Record<MessageKey, string>;

const de = {
  'language.label': 'Sprache',
  'nav.how': "So funktioniert's",
  'nav.why': 'Warum',
  'nav.faq': 'FAQ',
  'nav.handbook': 'Handbuch',
  'nav.login': 'Anmelden',
  'nav.legal': 'Impressum & Datenschutz',
  'aria.primary': 'Primär',
  'aria.menu': 'Menü',
  'aria.footer': 'Fusszeile',
  'aria.github': 'GitHub',
  'aria.handbookSections': 'Handbuchabschnitte',
  'home.headline1': 'Direkte Geschenke von Mensch zu Mensch',
  'home.headline2': 'über Bitcoin Lightning',
  'home.lead':
    'Bitten Sie um Hilfe oder senden Sie Hilfe — ohne Organisation dazwischen. Das Geld fliesst direkt von der gebenden zur empfangenden Person. Die Plattform verwahrt keinen Satoshi.',
  'home.ctaAsk': 'Hilfe erbitten',
  'home.ctaSend': 'Hilfe senden',
  'home.howKicker': "So funktioniert's",
  'home.howTitle': 'Drei Schritte, keine Konten im herkömmlichen Sinn',
  'home.howLead':
    '21.gifts nutzt LNURL-auth: Sie melden sich mit der Lightning-Wallet an, die Sie bereits haben. Keine Benutzernamen, keine Passwörter, keine E-Mail-Registrierung.',
  'home.step1Title': 'Mit der Wallet anmelden',
  'home.step1Body':
    'QR scannen oder Wallet of Satoshi öffnen. Die Wallet signiert eine einmalige Herausforderung. Diese Signatur ist Ihr Konto — sonst nichts merken.',
  'home.step2Title': 'Lightning Address hinterlegen',
  'home.step2BodyBefore': 'Hinterlegen Sie, wo Geschenke ankommen sollen, im üblichen',
  'home.step2BodyAfter': 'Format. Danach kann Ihnen jede Person aus der eigenen Wallet senden.',
  'home.step3Title': 'Geschenke kommen direkt an',
  'home.step3Body':
    'Gebende zahlen an Ihre Lightning Address. Die Satoshis landen in Ihrer Wallet, nicht bei uns. Die Plattform sieht das Geld nicht.',
  'home.whyKicker': 'Warum es das gibt',
  'home.whyTitle': 'Der kürzeste Weg von einer Person zur anderen',
  'home.why1Title': 'Echt peer-to-peer',
  'home.why1Body':
    'Das Geld geht von der Lightning-Wallet der gebenden Person an die Lightning Address der empfangenden Person. 21.gifts hält, routet oder treuhändert nichts. Es gibt nichts, das wir einfrieren könnten.',
  'home.why2Title': 'Ihre Wallet ist die Anmeldung',
  'home.why2Body':
    'Identität ist der Schlüssel, den Ihre Lightning-Wallet für diese Seite bereits hat. 21.gifts sieht den Schlüssel nicht — nur eine signierte Herausforderung. Keine Passwort-Datenbank, die lecken kann.',
  'home.why3Title': 'Offene Lightning-Schienen',
  'home.why3Body':
    'Geschenke nutzen Lightning Addresses und Rechnungen, die jede kompatible Wallet zahlen kann. Würde 21.gifts morgen verschwinden, funktionieren diese Adressen weiter.',
  'home.why4Title': 'Gemeinnützig by design',
  'home.why4Body':
    'Kein Take-Rate, keine Plattformgebühr, keine Finanzierungsrunde zum Amortisieren. Das Projekt trägt die eigene Infrastruktur und sonst nichts.',
  'home.faqKicker': 'FAQ',
  'home.faqTitle': 'Häufige Fragen, kurz beantwortet',
  'home.faq1Q': 'Wer kann das nutzen?',
  'home.faq1A':
    'Jede Person mit einer Lightning-Wallet, die LNURL-auth unterstützt (Wallet of Satoshi, Phoenix, Alby, Zeus und andere), und einer Lightning Address zum Empfangen. Kein Antrag, keine Prüfung.',
  'home.faq2Q': 'Behaltet ihr einen Anteil der Geschenke?',
  'home.faq2A':
    'Nein. Zahlungen gehen direkt von der Wallet der gebenden Person an die Lightning Address der empfangenden Person. 21.gifts liegt nicht im Zahlungsweg und verdient nichts pro Transaktion.',
  'home.faq3Q': 'Was passiert mit meinen Schlüsseln?',
  'home.faq3A':
    'Sie bleiben in Ihrer Lightning-Wallet. 21.gifts sieht nur eine signierte Login-Herausforderung und, wenn Sie das wollen, die Lightning Address, die Sie veröffentlichen. Kein Passwort und kein Seed auf unseren Servern.',
  'home.faq4Q': 'Kann ich den Zugang zu meinem Konto verlieren?',
  'home.faq4A':
    'Ja. Wenn Sie die Wallet verlieren (oder sie einen neuen LNURL-auth-Schlüssel ausstellt), ist das Konto in v1 nicht wiederherstellbar. Sichern Sie die Wallet, mit der Sie sich anmelden.',
  'home.faq5Q': 'Wie sende ich ein Geschenk?',
  'home.faq5A':
    'Öffnen Sie Hilfe senden, geben Sie die Lightning Address der empfangenden Person und einen Betrag in Sats ein und zahlen Sie die Rechnung aus einer beliebigen Lightning-Wallet. Zum Geben müssen Sie sich nicht anmelden.',
  'home.faq6Q': 'Warum nur Bitcoin Lightning?',
  'home.faq6A':
    'Lightning ist die einzige Schiene, die schnell, günstig, zensurresistent ist und mit einfachen Adressen wie E-Mail funktioniert. Sie braucht keine verwahrende Schicht und lässt weltweit ohne Erlaubnis geben und empfangen.',
  'home.faq7Q': 'Ist das reguliert, und wie ist das mit Steuern?',
  'home.faq7A':
    '21.gifts ist eine gemeinnützige Kommunikations- und Entdeckungsschicht. Es ist kein Zahlungsdienstleister und bewegt kein Geld. Gebende und Empfangende sind selbst für die steuerliche Behandlung in ihrem Rechtsraum verantwortlich.',
  'notFound.body': 'Diese Seite gibt es nicht.',
  'notFound.back': 'Zur Startseite',
  'handbook.title': 'Handbuch',
  'handbook.introBefore':
    'Das ist das Handbuch der 21.gifts-App: Screens, Funktionen und HTTP-Endpunkte. Das API-Handbuch liegt unter',
  'handbook.introAfter': '.',
  'login.pageTitle': 'Bei 21.gifts anmelden',
  'login.heading': 'Bei 21.gifts anmelden',
  'login.start': 'Mit Ihrer Lightning-Wallet anmelden',
  'login.preparing': 'Anmeldung wird vorbereitet…',
  'login.scan': 'Zum Anmelden scannen',
  'login.openWos': 'Wallet of Satoshi öffnen',
  'login.expired': 'Anmeldung abgelaufen',
  'login.error': 'Etwas ist schiefgelaufen. Bitte erneut versuchen.',
  'login.retry': 'Erneut versuchen',
  'login.signedIn': 'Angemeldet',
  'login.logOut': 'Abmelden',
  'login.qrLabel': 'Lightning-Login-QR-Code',
  'la.heading': 'Lightning Address',
  'la.prompt': 'Hinterlegen Sie eine Lightning Address, damit Geschenke Sie erreichen.',
  'la.save': 'Speichern',
  'la.link': 'Adresse verknüpfen',
  'la.cancel': 'Abbrechen',
  'la.edit': 'Bearbeiten',
  'la.unlink': 'Trennen',
  'la.aria': 'Lightning Address',
  'donate.pageTitle': 'Ein Geschenk senden',
  'donate.heading': 'Mit Lightning bezahlen',
  'donate.lead': 'Zahlen Sie an eine Lightning Address aus Ihrer Wallet. Kein Konto nötig.',
  'donate.addressLabel': 'Lightning Address',
  'donate.amountLabel': 'Betrag (Sats)',
  'donate.create': 'Rechnung erstellen',
  'donate.cancel': 'Abbrechen',
  'donate.openWallet': 'In der Wallet öffnen',
  'donate.invoiceQr': 'Lightning-Rechnungs-QR-Code',
  'donate.errorAddress': 'Lightning Address eingeben',
  'donate.errorAmount': 'Ganze Zahl von Sats grösser als null eingeben',
  'donate.range': 'Diese Adresse akzeptiert {min} – {max}.',
  'donate.pay': '{amount} an {address} zahlen',
  'donate.satOne': '1 Sat',
  'donate.sats': '{n} Sats',
} satisfies Messages;

const es = {
  'language.label': 'Idioma',
  'nav.how': 'Cómo funciona',
  'nav.why': 'Por qué',
  'nav.faq': 'FAQ',
  'nav.handbook': 'Manual',
  'nav.login': 'Iniciar sesión',
  'nav.legal': 'Aviso legal y privacidad',
  'aria.primary': 'Principal',
  'aria.menu': 'Menú',
  'aria.footer': 'Pie de página',
  'aria.github': 'GitHub',
  'aria.handbookSections': 'Secciones del manual',
  'home.headline1': 'Regalos directos de persona a persona',
  'home.headline2': 'por Bitcoin Lightning',
  'home.lead':
    'Pide ayuda o envía ayuda, sin una organización en medio. El dinero va directo de quien da a quien recibe — la plataforma no custodia ni un satoshi.',
  'home.ctaAsk': 'Pedir ayuda',
  'home.ctaSend': 'Enviar ayuda',
  'home.howKicker': 'Cómo funciona',
  'home.howTitle': 'Tres pasos, sin cuentas al estilo tradicional',
  'home.howLead':
    '21.gifts usa LNURL-auth: entras con la Lightning wallet que ya tienes. Sin nombres de usuario, sin contraseñas y sin registro por correo.',
  'home.step1Title': 'Entra con tu wallet',
  'home.step1Body':
    'Escanea un QR o abre Wallet of Satoshi. Tu wallet firma un desafío de un solo uso. Esa firma es tu cuenta — nada más que recordar.',
  'home.step2Title': 'Añade una Lightning Address',
  'home.step2BodyBefore': 'Indica dónde deben llegar los regalos, en la forma habitual',
  'home.step2BodyAfter': '. Cualquiera podrá enviarte desde su propia wallet.',
  'home.step3Title': 'Los regalos llegan directo',
  'home.step3Body':
    'Quien da paga a tu Lightning Address. Los satoshis llegan a tu wallet, no a la nuestra. La plataforma nunca ve el dinero.',
  'home.whyKicker': 'Por qué existe',
  'home.whyTitle': 'El camino más corto de una persona a otra',
  'home.why1Title': 'Peer-to-peer de verdad',
  'home.why1Body':
    'Los fondos van de la Lightning wallet de quien da a la Lightning Address de quien recibe. 21.gifts no retiene, enruta ni deja en depósito el dinero. No hay nada que podamos congelar.',
  'home.why2Title': 'Tu wallet es el inicio de sesión',
  'home.why2Body':
    'La identidad es la clave que tu Lightning wallet ya tiene para este sitio. 21.gifts no ve esa clave — solo un desafío firmado. No hay base de datos de contraseñas que se pueda filtrar.',
  'home.why3Title': 'Rieles Lightning abiertos',
  'home.why3Body':
    'Los regalos usan Lightning Addresses y facturas que cualquier wallet compatible puede pagar. Si 21.gifts desapareciera mañana, esas direcciones seguirían funcionando.',
  'home.why4Title': 'Sin ánimo de lucro por diseño',
  'home.why4Body':
    'No hay comisión, ni tarifa de plataforma, ni ronda de inversión que recuperar. El proyecto cubre su propia infraestructura y nada más.',
  'home.faqKicker': 'FAQ',
  'home.faqTitle': 'Preguntas frecuentes, en breve',
  'home.faq1Q': '¿Quién puede usarlo?',
  'home.faq1A':
    'Cualquiera con una Lightning wallet que soporte LNURL-auth (Wallet of Satoshi, Phoenix, Alby, Zeus y otras) y una Lightning Address para recibir. Sin solicitud ni proceso de revisión.',
  'home.faq2Q': '¿Se quedan con una parte de los regalos?',
  'home.faq2A':
    'No. Los pagos van directo de la wallet de quien da a la Lightning Address de quien recibe. 21.gifts no está en la ruta de pago y no gana nada por transacción.',
  'home.faq3Q': '¿Qué pasa con mis claves?',
  'home.faq3A':
    'Se quedan en tu Lightning wallet. 21.gifts solo ve un desafío de inicio de sesión firmado y, si lo eliges, la Lightning Address que publicas. No hay contraseña ni semilla en nuestros servidores.',
  'home.faq4Q': '¿Puedo perder el acceso a mi cuenta?',
  'home.faq4A':
    'Sí. Si pierdes la wallet (o emite una nueva clave LNURL-auth), la cuenta no se puede recuperar en v1. Conserva una copia de seguridad de la wallet con la que entras.',
  'home.faq5Q': '¿Cómo envío un regalo?',
  'home.faq5A':
    'Abre Enviar ayuda, escribe la Lightning Address de quien recibe y un monto en sats, y paga la factura desde cualquier Lightning wallet. No hace falta iniciar sesión para dar.',
  'home.faq6Q': '¿Por qué solo Bitcoin Lightning?',
  'home.faq6A':
    'Lightning es el único riel de pago rápido, de baja comisión, resistente a la censura y que funciona con direcciones simples como el correo. Elimina cualquier capa custodial y permite dar o recibir en cualquier lugar sin permiso.',
  'home.faq7Q': '¿Está regulado y cómo funcionan los impuestos?',
  'home.faq7A':
    '21.gifts es una capa de comunicación y descubrimiento sin ánimo de lucro. No es un proveedor de servicios de pago y no mueve fondos. Quien da y quien recibe son responsables de su propio tratamiento fiscal en su jurisdicción.',
  'notFound.body': 'Esta página no existe.',
  'notFound.back': 'Volver al inicio',
  'handbook.title': 'Manual',
  'handbook.introBefore':
    'Este es el manual de la app 21.gifts: pantallas, funciones y endpoints HTTP. El manual de la api está en',
  'handbook.introAfter': '.',
  'login.pageTitle': 'Inicia sesión en 21.gifts',
  'login.heading': 'Inicia sesión en 21.gifts',
  'login.start': 'Inicia sesión con tu Lightning wallet',
  'login.preparing': 'Preparando tu inicio de sesión…',
  'login.scan': 'Escanea para entrar',
  'login.openWos': 'Abrir Wallet of Satoshi',
  'login.expired': 'Inicio de sesión caducado',
  'login.error': 'Algo salió mal. Inténtalo de nuevo.',
  'login.retry': 'Intentar de nuevo',
  'login.signedIn': 'Sesión iniciada',
  'login.logOut': 'Cerrar sesión',
  'login.qrLabel': 'Código QR de inicio de sesión Lightning',
  'la.heading': 'Lightning Address',
  'la.prompt': 'Vincula una Lightning Address para que los regalos te lleguen.',
  'la.save': 'Guardar',
  'la.link': 'Vincular dirección',
  'la.cancel': 'Cancelar',
  'la.edit': 'Editar',
  'la.unlink': 'Desvincular',
  'la.aria': 'Lightning Address',
  'donate.pageTitle': 'Enviar un regalo',
  'donate.heading': 'Pagar con Lightning',
  'donate.lead': 'Paga a una Lightning Address desde tu wallet. No hace falta cuenta.',
  'donate.addressLabel': 'Lightning Address',
  'donate.amountLabel': 'Monto (sats)',
  'donate.create': 'Crear factura',
  'donate.cancel': 'Cancelar',
  'donate.openWallet': 'Abrir en la wallet',
  'donate.invoiceQr': 'Código QR de factura Lightning',
  'donate.errorAddress': 'Introduce una Lightning Address',
  'donate.errorAmount': 'Introduce un número entero de sats mayor que cero',
  'donate.range': 'Esta dirección acepta {min} – {max}.',
  'donate.pay': 'Paga {amount} a {address}',
  'donate.satOne': '1 sat',
  'donate.sats': '{n} sats',
} satisfies Messages;

const fil = {
  'language.label': 'Wika',
  'nav.how': 'Paano ito gumagana',
  'nav.why': 'Bakit',
  'nav.faq': 'FAQ',
  'nav.handbook': 'Handbook',
  'nav.login': 'Mag-log in',
  'nav.legal': 'Legal at Privacy',
  'aria.primary': 'Pangunahin',
  'aria.menu': 'Menu',
  'aria.footer': 'Footer',
  'aria.github': 'GitHub',
  'aria.handbookSections': 'Mga seksyon ng handbook',
  'home.headline1': 'Direktang handog mula tao patungo sa tao',
  'home.headline2': 'sa Bitcoin Lightning',
  'home.lead':
    'Humiling ng tulong, o magpadala ng tulong, nang walang organisasyon sa gitna. Diretso ang pera mula sa nagbibigay patungo sa tumatanggap — walang satoshi na hawak ng platform.',
  'home.ctaAsk': 'Humiling ng tulong',
  'home.ctaSend': 'Magpadala ng tulong',
  'home.howKicker': 'Paano ito gumagana',
  'home.howTitle': 'Tatlong hakbang, walang account sa tradisyonal na paraan',
  'home.howLead':
    'Gumagamit ang 21.gifts ng LNURL-auth: mag-log in ka gamit ang Lightning wallet na meron ka na. Walang username, walang password, at walang email sign-up.',
  'home.step1Title': 'Mag-log in gamit ang wallet',
  'home.step1Body':
    'I-scan ang QR o buksan ang Wallet of Satoshi. Pipirma ang wallet ng one-time challenge. Ang pirma na iyon ang account mo — wala nang ibang tandaan.',
  'home.step2Title': 'Magdagdag ng Lightning Address',
  'home.step2BodyBefore': 'I-link kung saan dapat tumama ang mga handog, sa karaniwang',
  'home.step2BodyAfter': 'na anyo. Sino pa man ay puwedeng magpadala mula sa sarili niyang wallet.',
  'home.step3Title': 'Diretso ang dating ng handog',
  'home.step3Body':
    'Nagbabayad ang nagbibigay sa iyong Lightning Address. Sa wallet mo bumabagsak ang mga satoshi, hindi sa amin. Hindi nakikita ng platform ang pera.',
  'home.whyKicker': 'Bakit ito umiiral',
  'home.whyTitle': 'Ang pinakamaikling daan mula sa isang tao patungo sa iba',
  'home.why1Title': 'Tunay na peer-to-peer',
  'home.why1Body':
    'Gumagalaw ang pondo mula sa Lightning wallet ng nagbibigay patungo sa Lightning Address ng tumatanggap. Hindi humahawak, nagr-route, o nag-escrow ang 21.gifts. Walang pwedeng i-freeze.',
  'home.why2Title': 'Ang wallet mo ang login',
  'home.why2Body':
    'Ang identidad ay ang key na hawak na ng Lightning wallet mo para sa site na ito. Hindi nakikita ng 21.gifts ang key na iyon — signed challenge lang. Walang password database na pwedeng tumagas.',
  'home.why3Title': 'Bukas na Lightning rails',
  'home.why3Body':
    'Gumagamit ang mga handog ng Lightning Address at invoice na kayang bayaran ng kahit anong compatible na wallet. Kung mawala ang 21.gifts bukas, gagana pa rin ang mga address na iyon.',
  'home.why4Title': 'Non-profit by design',
  'home.why4Body':
    'Walang take-rate, walang platform fee, at walang fundraising round na babawiin. Sinasagot ng proyekto ang sarili nitong infrastructure at wala nang iba.',
  'home.faqKicker': 'FAQ',
  'home.faqTitle': 'Mga karaniwang tanong, maikling sagot',
  'home.faq1Q': 'Sino ang puwedeng gumamit nito?',
  'home.faq1A':
    'Sinumang may Lightning wallet na sumusuporta sa LNURL-auth (Wallet of Satoshi, Phoenix, Alby, Zeus, at iba pa) at Lightning Address para tumanggap. Walang application, walang review process.',
  'home.faq2Q': 'Kumuha ba kayo ng parte sa mga handog?',
  'home.faq2A':
    'Hindi. Diretso ang bayad mula sa wallet ng nagbibigay patungo sa Lightning Address ng tumatanggap. Wala ang 21.gifts sa payment path at walang kita per transaction.',
  'home.faq3Q': 'Ano ang nangyayari sa mga key ko?',
  'home.faq3A':
    'Nanatili ang mga iyon sa iyong Lightning wallet. Nakikita lang ng 21.gifts ang signed login challenge at, kung pipiliin mo, ang Lightning Address na ipinapaskil mo. Walang password at walang seed sa aming servers.',
  'home.faq4Q': 'Puwede ba akong mawalan ng access sa account?',
  'home.faq4A':
    'Oo. Kung mawala ang wallet (o mag-issue ito ng bagong LNURL-auth key), hindi na mare-recover ang account sa v1. Mag-backup ng wallet na ginagamit mo sa pag-log in.',
  'home.faq5Q': 'Paano ako magpapadala ng handog?',
  'home.faq5A':
    'Buksan ang Magpadala ng tulong, ilagay ang Lightning Address ng tatanggap at ang amount sa sats, tapos bayaran ang invoice mula sa kahit anong Lightning wallet. Hindi kailangang mag-log in para magbigay.',
  'home.faq6Q': 'Bakit Bitcoin Lightning lang?',
  'home.faq6A':
    'Ang Lightning lang ang payment rail na mabilis, mababa ang fee, hindi madaling i-censor, at gumagana sa simpleng address na parang email. Inaalis nito ang kailangan ng custodial layer at pinapayagan ang sinuman sa mundo na magbigay o tumanggap nang walang permiso.',
  'home.faq7Q': 'Regulado ba ito, at paano ang buwis?',
  'home.faq7A':
    'Ang 21.gifts ay non-profit na communication at discovery layer. Hindi ito payment service provider at hindi ito naglilipat ng pondo. Responsibilidad ng nagbibigay at tumatanggap ang sarili nilang tax treatment sa kanilang hurisdiksyon.',
  'notFound.body': 'Walang ganitong page.',
  'notFound.back': 'Bumalik sa home',
  'handbook.title': 'Handbook',
  'handbook.introBefore':
    'Ito ang handbook ng 21.gifts app: screens, functions, at HTTP endpoints. Ang api handbook ay nasa',
  'handbook.introAfter': '.',
  'login.pageTitle': 'Mag-log in sa 21.gifts',
  'login.heading': 'Mag-log in sa 21.gifts',
  'login.start': 'Mag-log in gamit ang iyong Lightning wallet',
  'login.preparing': 'Inihahanda ang login mo…',
  'login.scan': 'I-scan para mag-log in',
  'login.openWos': 'Buksan ang Wallet of Satoshi',
  'login.expired': 'Nag-expire ang login',
  'login.error': 'May nangyaring mali. Subukan ulit.',
  'login.retry': 'Subukan ulit',
  'login.signedIn': 'Naka-log in',
  'login.logOut': 'Mag-log out',
  'login.qrLabel': 'Lightning login QR code',
  'la.heading': 'Lightning Address',
  'la.prompt': 'Mag-link ng Lightning Address para maabot ka ng mga handog.',
  'la.save': 'I-save',
  'la.link': 'I-link ang address',
  'la.cancel': 'Kanselahin',
  'la.edit': 'I-edit',
  'la.unlink': 'I-unlink',
  'la.aria': 'Lightning Address',
  'donate.pageTitle': 'Magpadala ng handog',
  'donate.heading': 'Magbayad gamit ang Lightning',
  'donate.lead': 'Magbayad sa Lightning Address mula sa wallet mo. Hindi kailangan ng account.',
  'donate.addressLabel': 'Lightning Address',
  'donate.amountLabel': 'Amount (sats)',
  'donate.create': 'Gumawa ng invoice',
  'donate.cancel': 'Kanselahin',
  'donate.openWallet': 'Buksan sa wallet',
  'donate.invoiceQr': 'Lightning invoice QR code',
  'donate.errorAddress': 'Maglagay ng Lightning Address',
  'donate.errorAmount': 'Maglagay ng buong numero ng sats na higit sa zero',
  'donate.range': 'Tumatanggap ang address na ito ng {min} – {max}.',
  'donate.pay': 'Magbayad ng {amount} kay {address}',
  'donate.satOne': '1 sat',
  'donate.sats': '{n} sats',
} satisfies Messages;

/**
 * Message catalogs for every supported locale. Keys are identical across locales.
 */
export const catalogs: Record<Locale, Messages> = {
  en: { ...en },
  de,
  es,
  fil,
};

/**
 * Returns the message catalog for a supported locale.
 *
 * Exhaustive over {@link Locale} so callers avoid `noUncheckedIndexedAccess`
 * gaps when indexing {@link catalogs}.
 *
 * @param locale - Supported UI locale.
 * @returns The catalog for that locale.
 */
export function getCatalog(locale: Locale): Messages {
  switch (locale) {
    case 'en':
      return catalogs.en;
    case 'de':
      return catalogs.de;
    case 'es':
      return catalogs.es;
    case 'fil':
      return catalogs.fil;
  }
}
