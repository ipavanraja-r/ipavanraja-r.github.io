---
title: "5G RedCap: reduced capability, reduced margin"
date: 2026-11-14
tags: [5g, iot, research]
summary: RedCap trims 5G down for wearables, sensors and cameras. The cryptography stays the same, but the safety margins shrink. A field guide to where that matters.
featured: true
---

5G RedCap (Reduced Capability, sometimes called *NR-Light*) arrived in 3GPP Release 17 to fill the gap between full-fat 5G and low-power IoT technologies like NB-IoT and LTE-M. Think industrial wireless sensors, video surveillance and wearables: devices that need more than a trickle of bandwidth, but can't afford the cost or battery drain of a flagship modem.

To get there, RedCap removes things. And every feature you remove from a radio is also a margin you remove from its defences.

> [!NOTE]
> This post summarises themes from our survey, *[A Comprehensive Survey on 5G RedCap: Technologies, Security Vulnerabilities, and Attack Vectors](https://doi.org/10.3390/fi18030118)* (Future Internet, 2026). See the paper for the full taxonomy and references.

## What actually gets reduced

RedCap keeps the 5G core, the 5G security architecture and the same authentication and key agreement. What changes is the device's radio and how it behaves:

| Capability | Typical 5G NR device | Rel-17 RedCap device |
|---|---|---|
| Max bandwidth (FR1) | 100 MHz | 20 MHz |
| Receive branches | 2–4 | 1 (2 optional) |
| Duplex | Full-duplex FDD | Half-duplex FDD optional |
| DL MIMO layers | up to 4 | 1–2 |
| Idle-mode eDRX | — | extended cycles, up to hours |

On paper, none of these are security features. In practice, each one changes how much abuse a device can absorb.

## Three places the margin disappears

### 1. One antenna, no second opinion

With a single receive branch (**1Rx**), a device loses receive diversity, the natural redundancy that lets a multi-antenna receiver ride out fades and interference. The result is a smaller link budget and less tolerance for a hostile RF environment. Targeted interference that a 4Rx phone would shrug off can push a 1Rx sensor into retransmissions, radio link failure and re-attach loops.

### 2. Half-duplex timing

Half-duplex FDD (**HD-FDD**) devices can't transmit and receive at the same time; they switch between the two. That makes scheduling tighter and creates windows where the device is deaf by design. Attacks that force extra uplink activity, or that land control traffic in the wrong window, cost more on a half-duplex device than on a full-duplex one.

### 3. Sleep as an attack surface

Extended discontinuous reception (**eDRX**) is how RedCap devices reach multi-year battery life: they sleep for long stretches and wake briefly to check for paging. That creates two opposite problems:

- **Battery drain**: anything that repeatedly forces a device to wake, page, re-establish or re-measure eats directly into its energy budget.
- **Unreachability**: a device that legitimately sleeps for long periods is also one whose absence is easy to hide, which matters for safety-relevant sensors.

> [!PULL]
> On a phone, a nuisance attack costs a few percent of battery. On a sensor budgeted for ten years, it costs the deployment.

## Measuring it on a testbed

Arguments like these are only useful if you can measure them. Our lab setup is a 5G Standalone network built entirely from open-source components:

- **Open5GS** for the 5G core (AMF, SMF, UPF, …)
- **UERANSIM** for the gNB and simulated UEs
- **Prometheus + Grafana** for high-resolution telemetry of attach rates, signalling load and resource use

Bringing up the RAN side is two commands once the core is running:

```bash
# terminal 1: simulated gNB
./nr-gnb -c config/open5gs-gnb.yaml

# terminal 2: simulated UE that registers through it
sudo ./nr-ue -c config/open5gs-ue.yaml
```

> [!WARNING]
> UERANSIM simulates the protocol stack, not the physical layer. PHY-level effects such as 1Rx sensitivity have to be modelled or emulated separately. Be explicit about which results come from protocol simulation and which from RF modelling.

## What defenders should take away

1. **Don't assume "same crypto" means "same risk."** RedCap's authentication is as strong as 5G's; its resilience isn't.
2. **Monitor signalling, not just traffic.** Abnormal paging, re-registration or measurement activity is often the first sign of an energy-drain attack.
3. **Budget for abuse.** If a device's battery life is a safety property, test it under adversarial conditions, not just nominal duty cycles.
4. **Know your device class.** RedCap devices identify themselves early in access, which helps the network but also tells an observer which devices are the constrained ones.

---

RedCap is going to be everywhere cellular IoT is: in factories, in cities, on people's wrists. The time to understand its failure modes is now, while the deployments are still young.

*Questions, corrections or collaboration ideas? [Get in touch](../index.html#contact).*
