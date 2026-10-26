import { Award, BedDouble, DoorOpen, FileQuestion, Fingerprint, GraduationCap, HeartPulse, Library, MessageSquareWarning, Package, Video, type LucideIcon } from "lucide-react";
import type { Bi } from "./i18n";

/**
 * Modules a school expects that aren't built yet (user, 2026-10-26: "live classes, CBC etc. jo hota hai,
 * unpe likhna, only coming soon"). Each opens /erp/soon/?m=<key> with what it will do. Nothing behind them yet.
 */
export interface SoonModule {
  key: string;
  icon: LucideIcon;
  text: Bi;
  lines: Bi[];
}

export const SOON_MODULES: SoonModule[] = [
  {
    key: "live-classes",
    icon: Video,
    text: { hi: "लाइव क्लास", en: "Live classes" },
    lines: [
      { hi: "टीचर ऐप से ऑनलाइन क्लास शुरू करें, बच्चों को पेरेंट ऐप में लिंक मिले।", en: "Teachers start an online class from the staff app; children get the link in the parent app." },
      { hi: "कौन जुड़ा, कितनी देर रहा, अपने आप हाज़िरी।", en: "Who joined and for how long, counted as attendance." },
      { hi: "क्लास की रिकॉर्डिंग बाद में देखने के लिए।", en: "Recordings to watch later." },
    ],
  },
  {
    key: "hpc",
    icon: Award,
    text: { hi: "CBC / समग्र प्रगति कार्ड", en: "CBC / Holistic progress card" },
    lines: [
      { hi: "NEP 2020 वाला योग्यता आधारित (Competency Based) कार्ड।", en: "The NEP 2020 competency-based progress card." },
      { hi: "पढ़ाई के साथ खेल, कला, व्यवहार और कौशल पर टीचर की राय।", en: "Teachers rate skills, sports, art and behaviour, not only marks." },
      { hi: "बच्चे की खुद की और माता-पिता की राय भी।", en: "Includes the child's own and the parents' view." },
    ],
  },
  {
    key: "online-test",
    icon: FileQuestion,
    text: { hi: "ऑनलाइन टेस्ट", en: "Online tests" },
    lines: [
      { hi: "टीचर सवाल बनाएँ, बच्चे पेरेंट ऐप पर टेस्ट दें।", en: "Teachers set questions; children take the test in the parent app." },
      { hi: "ऑब्जेक्टिव सवालों के अंक अपने आप।", en: "Objective questions are marked automatically." },
      { hi: "अंक सीधे परीक्षा के रिकॉर्ड में।", en: "Scores go straight into the exam records." },
    ],
  },
  {
    key: "library",
    icon: Library,
    text: { hi: "लाइब्रेरी", en: "Library" },
    lines: [
      { hi: "किताबों की लिस्ट, कौन-सी किताब किसके पास है।", en: "Book list and who has which book." },
      { hi: "किताब देना-लेना, लौटाने की तारीख और देरी का जुर्माना।", en: "Issue and return, due dates and late fines." },
    ],
  },
  {
    key: "hostel",
    icon: BedDouble,
    text: { hi: "हॉस्टल", en: "Hostel" },
    lines: [
      { hi: "कमरे और बेड, कौन बच्चा कहाँ रहता है।", en: "Rooms and beds, which child stays where." },
      { hi: "हॉस्टल फ़ीस, रात की हाज़िरी और घर जाने की छुट्टी।", en: "Hostel fees, night roll call and home leave." },
    ],
  },
  {
    key: "inventory",
    icon: Package,
    text: { hi: "स्टोर और सामान", en: "Inventory & store" },
    lines: [
      { hi: "यूनिफ़ॉर्म, किताबें, कॉपियाँ: कितना स्टॉक बचा है।", en: "Uniforms, books, notebooks: how much stock is left." },
      { hi: "बच्चों को बेचा सामान रसीद के साथ।", en: "Sales to students with a receipt." },
      { hi: "स्कूल का सामान (फ़र्नीचर, कंप्यूटर) का रिकॉर्ड।", en: "A record of school assets (furniture, computers)." },
    ],
  },
  {
    key: "visitors",
    icon: DoorOpen,
    text: { hi: "विज़िटर रजिस्टर", en: "Visitor log" },
    lines: [
      { hi: "गेट पर कौन आया, किससे मिलने, कब आया-गया।", en: "Who came to the gate, whom they met, in and out times." },
      { hi: "बच्चे को लेने आए व्यक्ति की फ़ोटो और मोबाइल।", en: "Photo and mobile of whoever picks a child up." },
    ],
  },
  {
    key: "health",
    icon: HeartPulse,
    text: { hi: "स्वास्थ्य रिकॉर्ड", en: "Health records" },
    lines: [
      { hi: "बच्चे की लंबाई, वज़न, आँख और दाँत की जाँच।", en: "Height, weight, eye and dental check-ups." },
      { hi: "एलर्जी और बीमारी की जानकारी टीचर को दिखे।", en: "Allergies and conditions shown to teachers." },
    ],
  },
  {
    key: "complaints",
    icon: MessageSquareWarning,
    text: { hi: "शिकायत पेटी", en: "Complaint box" },
    lines: [
      { hi: "माता-पिता और स्टाफ़ ऐप से शिकायत या सुझाव भेजें।", en: "Parents and staff send a complaint or suggestion from the app." },
      { hi: "हर शिकायत का हाल: खुली, देख रहे हैं, हल हुई।", en: "Each one tracked: open, in progress, solved." },
    ],
  },
  {
    key: "alumni",
    icon: GraduationCap,
    text: { hi: "पुराने छात्र", en: "Alumni" },
    lines: [
      { hi: "स्कूल छोड़ चुके बच्चों का रिकॉर्ड और संपर्क।", en: "Records and contacts of past students." },
      { hi: "पुराने छात्रों को कार्यक्रम का न्योता।", en: "Invite them to school events." },
    ],
  },
  {
    key: "biometric",
    icon: Fingerprint,
    text: { hi: "बायोमेट्रिक हाज़िरी", en: "Biometric attendance" },
    lines: [
      { hi: "अंगूठा या चेहरा पहचानने वाली मशीन से स्टाफ़ और बच्चों की हाज़िरी।", en: "Staff and student attendance from a fingerprint or face machine." },
      { hi: "आने-जाने का समय अपने आप हाज़िरी और सैलरी में।", en: "In and out times flow into attendance and salary." },
    ],
  },
];
