/* =========================================================
   Certifications: single source of truth.
   Used by certifications.html (the vault) and the strip on index.html.

   Add a new certificate by copying one block below.
     id           unique slug (letters, numbers, dashes)
     code         2–4 letter emblem shown on the badge
     date         "YYYY-MM"
     category     one of: offensive | mobile | defense | hardware | analytics
     status       "verified" | "in-progress"
     verify       public credential URL (leave "" if none)
     credentialId the ID printed on the certificate (optional)
     image        path to a scan/PNG of the certificate, e.g. "assets/certs/jpt.png" (optional)
   ========================================================= */
window.CERTS = [
  {
    id: "thm-jpt",
    code: "JPT",
    title: "Jr Penetration Tester",
    issuer: "TryHackMe",
    date: "2026-03",
    category: "offensive",
    status: "verified",
    summary: "Hands-on pentesting path covering enumeration, web application exploitation, privilege escalation and the core offensive toolchain.",
    skills: ["Recon & Enumeration", "Burp Suite", "Metasploit", "Privilege Escalation", "Web Exploitation"],
    verify: "https://tryhackme.com/p/p1r3x",
    credentialId: "",
    image: "",
  },
  {
    id: "neo4j-pro",
    code: "N4J",
    title: "Neo4j Certified Professional",
    issuer: "Neo4j",
    date: "2025-12",
    category: "analytics",
    status: "verified",
    summary: "Graph data modelling and Cypher querying, applied to cybersecurity graph analytics: attack paths, relationships and threat modelling.",
    skills: ["Graph Modelling", "Cypher", "Attack-Path Analysis", "Security Analytics"],
    verify: "",
    credentialId: "",
    image: "",
  },
  {
    id: "mhl-mobile",
    code: "MOB",
    title: "Android & iOS Application Security Fundamentals",
    issuer: "Mobile Hacking Lab",
    date: "2025-08",
    category: "mobile",
    status: "verified",
    summary: "Advanced mobile pentesting foundations: app internals, insecure storage, IPC, traffic interception and platform-specific attack surface.",
    skills: ["Android AppSec", "iOS AppSec", "Traffic Interception", "Static & Dynamic Analysis"],
    verify: "",
    credentialId: "",
    image: "",
  },
  {
    id: "cisco-eh",
    code: "EH",
    title: "Ethical Hacker",
    issuer: "Cisco Networking Academy",
    date: "2025-02",
    category: "offensive",
    status: "verified",
    summary: "Structured ethical hacking methodology, from planning and reconnaissance through exploitation, post-exploitation and reporting.",
    skills: ["Pentest Methodology", "Network Attacks", "Vulnerability Scanning", "Reporting"],
    verify: "",
    credentialId: "",
    image: "",
  },
  {
    id: "umd-hws",
    code: "HWS",
    title: "Hardware Security",
    issuer: "University of Maryland · Coursera",
    date: "2024-12",
    category: "hardware",
    status: "verified",
    summary: "IoT and hardware attack research: side-channel attacks, physical tampering, hardware Trojans and hardware-rooted trust.",
    skills: ["Side-Channel Attacks", "IoT Hardware", "Physical Attacks", "Hardware Trust"],
    verify: "",
    credentialId: "",
    image: "",
  },
];

window.CERT_CATEGORIES = {
  offensive: { label: "Offensive", color: "#ff2a4a" },
  mobile:    { label: "Mobile",    color: "#00ff9c" },
  defense:   { label: "Defense",   color: "#2de2ff" },
  hardware:  { label: "Hardware",  color: "#ffc857" },
  analytics: { label: "Analytics", color: "#2de2ff" },
};
