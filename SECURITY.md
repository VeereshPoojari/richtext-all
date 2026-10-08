# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions of `richtext-all`:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Security Architecture & Design Principles

`richtext-all` is built with a **Zero-Trust, Zero-Dependency** security model for document authoring and live collaboration:

1. **Strict Context-Aware DOM Sanitization**:
   - All pasted HTML, markdown blocks, image URLs, and user inputs are strictly sanitized before injection.
   - Disallows dangerous URL schemes (`javascript:`, `data:text/html`, `vbscript:`).
   - Enforces `rel="noopener noreferrer"` on all hyperlinks.
2. **Zero External Runtime Dependencies**:
   - Zero third-party npm packages eliminates supply-chain vulnerabilities, malicious package takeovers, and Dependabot vulnerability alerts.
3. **Collaboration Stream Isolation**:
   - Real-time keystroke and delta synchronization streams are sanitized before applying mutations to the local document DOM.
4. **Content Security Policy (CSP) Compatibility**:
   - Designed to run cleanly under strict Content Security Policies without requiring `unsafe-eval`.

---

## Reporting a Vulnerability

We take the security of `richtext-all` very seriously. If you discover a security vulnerability, please report it privately:

- **Email Security Maintainer**: Contact `veeresha3993@gmail.com` with the subject `[SECURITY VULNERABILITY] richtext-all`.
- **GitHub Private Advisory**: [Submit a Security Advisory](https://github.com/VeereshPoojari/richtext-all/security/advisories/new)

### Response SLA:
- **Initial Response**: Within 24–48 hours.
- **Triage & Status Update**: Within 72 hours.
- **Fix & Advisory Release**: Coordinated disclosure within 7–14 days.
