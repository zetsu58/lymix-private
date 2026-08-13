# LYMIX V21.10 Creator / Broadcaster Verification

## APK findings
Xena APK exposes phone auth / phone verification / phone binding resources,
Host Center / Agency Center / Join Agency or Be Host resources, and camera/video
components. Resource names alone do not prove a women-only video-verification rule.

## Lymix policy
Creator verification is available under the same process for all applicants.
Gender may be optional profile information but must not be the sole criterion
for access to earning/broadcaster status.

## Flow
1. Authenticated Lymix account.
2. Phone number in E.164-like form.
3. OTP request + confirmation.
4. Minimum device metadata: installation ID, platform, OS version.
5. Live camera video, max ~20 seconds.
6. Optional agency ID/code.
7. Pending review.
8. Admin: APPROVED / REJECTED / NEEDS_REVERIFY.
9. Audit log on submission/review.

## Privacy / security
- Do not expose raw phone to ordinary clients; admin listing uses masked phone.
- Verification video must not be public static content.
- Production should use signed/private object storage, retention/deletion policy,
  encryption, access audit and user deletion request workflow.
- OTP must use a real SMS provider in production; debug OTP must never be logged.
- Device metadata must be minimal and disclosed in privacy policy.
- Do not collect IMEI, serial, contact list or unrelated device identifiers.
- Creator payout additionally requires payout/KYC rules where legally required.
