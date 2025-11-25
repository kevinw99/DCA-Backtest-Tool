# Trade Secrets

**CONFIDENTIAL AND PROPRIETARY**

**Copyright © 2025 Kevin Weng. All Rights Reserved.**

---

## ⚠️ LEGAL NOTICE

This document identifies trade secret information. Unauthorized access, use, or disclosure is strictly prohibited and may result in legal action.

**If you have received this document in error, please notify kevin.weng.ai@gmail.com immediately and destroy all copies.**

---

## What Are Trade Secrets?

Trade secrets are confidential business information that:
1. Derive economic value from not being generally known
2. Are subject to reasonable efforts to maintain secrecy
3. Are protected by law from unauthorized disclosure

**Legal Protection**: Trade secret misappropriation is punishable under the Defend Trade Secrets Act (DTSA) and state laws, with penalties including:
- Injunctions against use or disclosure
- Monetary damages (actual losses + unjust enrichment)
- Exemplary damages (up to 2x actual damages for willful violations)
- Attorney's fees for willful and malicious misappropriation

---

## Protected Trade Secret Files

The following files contain proprietary algorithms and implementations that constitute trade secrets:

### 1. DCA Backtest Service
**File**: `/backend/services/dcaBacktestService.js`

**What's Protected**:
- Grid-based DCA execution logic
- Trailing stop loss/profit algorithms
- Order execution and cancellation rules
- Peak/bottom tracking methodology
- Transaction logging implementation
- Performance calculation algorithms

**Why It's Valuable**:
- Novel combination of DCA + grid spacing + momentum trading
- Years of refinement and testing
- Optimized for specific market conditions
- Core competitive advantage

**Access**: NDA required

---

### 2. Portfolio Backtest Service
**File**: `/backend/services/portfolioBacktestService.js`

**What's Protected**:
- Multi-stock portfolio optimization
- Portfolio-level metrics calculation
- Cross-stock correlation handling
- Portfolio rebalancing algorithms
- Aggregate performance tracking

**Why It's Valuable**:
- Extends grid-based DCA to portfolio management
- Sophisticated aggregation and correlation analysis
- Enables comparative strategy analysis

**Access**: NDA required

---

### 3. Batch Backtest Service
**File**: `/backend/services/batchBacktestService.js`

**What's Protected**:
- Batch processing optimization
- Parameter sweep methodologies
- Result aggregation algorithms
- Statistical analysis techniques
- Performance comparison logic

**Why It's Valuable**:
- Enables large-scale strategy testing
- Optimized for computational efficiency
- Powers systematic strategy discovery

**Access**: NDA required

---

### 4. Beta Calculation Utility
**File**: `/backend/utils/calculateBeta.js`

**What's Protected**:
- Beta calculation implementation
- Market correlation algorithms
- Statistical analysis methods
- Data normalization techniques
- Edge case handling

**Why It's Valuable**:
- Integral to DCA suitability scoring
- Proprietary approach to beta grouping
- Optimized for trading strategy context

**Access**: NDA required

---

### 5. Performance Metrics Utility
**File**: `/backend/utils/performanceMetrics.js`

**What's Protected**:
- Sharpe ratio calculation
- Maximum drawdown algorithm
- Win rate computation
- ROI/returns calculations
- Consecutive incremental profit tracking
- Custom metrics implementations

**Why It's Valuable**:
- Unified metrics calculation framework
- Handles edge cases and data quality issues
- Optimized for accuracy and performance
- Powers comparative analysis

**Access**: NDA required

---

## Access Control Policies

### Who Can Access Trade Secrets?

**Authorized Access (With Signed NDA)**:
- Core development team
- Designated collaborators
- Approved consultants
- Licensed partners

**Unauthorized Access**:
- General public
- Casual contributors
- Collaborators without NDA
- Competitors

### Access Request Process

1. **Submit Request**: Email kevin.weng.ai@gmail.com
2. **Business Justification**: Explain why access is needed
3. **NDA Execution**: Sign customized NDA (see NDA-TEMPLATE.md)
4. **Access Grant**: Receive credentials/permissions
5. **Training**: Review confidentiality obligations
6. **Documentation**: Agreement recorded in project records

---

## Confidentiality Obligations

### What You MUST Do

If you have access to trade secret files, you must:

✅ **Maintain Secrecy**:
- Keep code and implementation details confidential
- Store files securely (encrypted, password-protected)
- Never share with unauthorized parties

✅ **Use Only for Authorized Purposes**:
- Use trade secrets only for approved project work
- Do not use for personal projects
- Do not use for competing products

✅ **Report Breaches**:
- Immediately report any suspected unauthorized access
- Notify if you accidentally disclose confidential information
- Report if you suspect others have misappropriated trade secrets

✅ **Return Materials**:
- Upon termination of collaboration, return or destroy all copies
- Delete files from personal devices
- Confirm deletion in writing

### What You MUST NOT Do

❌ **DO NOT**:
- Share code with unauthorized parties
- Discuss implementation details publicly (forums, social media, blog posts)
- Copy code for use in other projects without permission
- Reverse engineer or decompile
- Disclose algorithmic details to competitors
- Post trade secret code on public repositories (even accidentally)
- Take screenshots or photos of confidential code
- Print confidential code on shared printers

---

## Public vs. Confidential Information

### What You CAN Discuss Publicly

**Safe to Share (No NDA Required)**:
- ✅ General concept: "Grid-based DCA strategy"
- ✅ High-level methodology: "Uses price levels and momentum"
- ✅ Tool capabilities: "Backtests DCA strategies"
- ✅ User interface and features
- ✅ General results: "Achieved X% return on test data"
- ✅ Documentation and user guides
- ✅ Links to ORIGINALITY-ASSESSMENT.md

### What You CANNOT Discuss Publicly

**Confidential (NDA Required)**:
- ❌ Specific algorithm implementations
- ❌ Exact formulas (e.g., DCA Suitability Score calculation)
- ❌ Code snippets from trade secret files
- ❌ Performance optimization techniques
- ❌ Edge case handling details
- ❌ Internal variable names, function signatures
- ❌ Debugging logs showing algorithm internals

**When in Doubt**: Ask first. Contact kevin.weng.ai@gmail.com

---

## Penalties for Unauthorized Disclosure

### Legal Consequences

**Violators may face**:

1. **Civil Liability**:
   - Injunctions prohibiting use or further disclosure
   - Monetary damages for economic harm
   - Unjust enrichment disgorgement
   - Exemplary damages (up to 2x actual damages)
   - Attorney's fees and court costs

2. **Criminal Liability** (if applicable):
   - Economic Espionage Act violations
   - Fines and imprisonment for trade secret theft

3. **Contractual Liability**:
   - Breach of NDA
   - Breach of employment/collaboration agreement
   - Loss of access and termination

### Example Scenarios

**Scenario 1**: Developer posts code snippet from dcaBacktestService.js on Stack Overflow
- **Violation**: Unauthorized disclosure of trade secret
- **Consequences**: NDA breach, injunction, monetary damages

**Scenario 2**: Consultant discusses algorithm details in blog post
- **Violation**: Public disclosure of confidential information
- **Consequences**: Cease and desist, removal of content, damages

**Scenario 3**: Former collaborator uses algorithm in competing product
- **Violation**: Trade secret misappropriation
- **Consequences**: Injunction, damages, possible criminal charges

---

## Security Measures

### How We Protect Trade Secrets

1. **Confidential Markings**: All trade secret files have "CONFIDENTIAL - TRADE SECRET" headers
2. **Access Control**: Only authorized users with signed NDAs can access
3. **Documentation**: This file and IP-PROTECTION-STRATEGY.md
4. **NDA Requirements**: Legal agreements with all collaborators
5. **Education**: Training on confidentiality obligations
6. **Monitoring**: Regular review of access and compliance

### Best Practices for Handling Trade Secrets

**If you have access**:

1. **Storage**:
   - Keep files on encrypted devices
   - Use strong passwords
   - Enable 2FA on GitHub
   - Never store on shared drives without encryption

2. **Sharing**:
   - Only share with authorized parties
   - Use secure channels (encrypted email)
   - Verify recipient authorization before sending

3. **Development**:
   - Never commit trade secrets to public repositories
   - Use .gitignore for sensitive files
   - Review commits before pushing
   - Use private branches for sensitive work

4. **Communication**:
   - Mark emails containing trade secrets as "CONFIDENTIAL"
   - Use secure messaging for discussions
   - Avoid discussing on public Slack/Discord channels
   - Be cautious in screen sharing sessions

---

## Relationship to Open Source

### MIT License vs. Trade Secrets

**The code is MIT licensed (public), but trade secrets are protected. How?**

**MIT License Grants**:
- ✅ Right to use, modify, distribute the code
- ✅ Commercial use permitted
- ✅ Private use permitted

**Trade Secret Protection Provides**:
- 🔒 Legal recourse for unauthorized disclosure of implementation details
- 🔒 NDA enforcement for collaborators with access
- 🔒 Ability to control who learns the proprietary techniques

**Key Distinction**:
- **Code availability** ≠ **Implementation knowledge**
- Public code can still contain valuable trade secrets if the code is complex, not well-documented, or the value is in the methodology, not just the code itself

**Example**:
- Google's search algorithm is a trade secret even though much of the code is public
- Coca-Cola's formula is a trade secret even though the product is sold publicly

---

## Defensive Publication

While trade secret files are confidential, the **innovations** themselves are documented in ORIGINALITY-ASSESSMENT.md as **defensive publication** (prior art).

**This is not a contradiction**:
- **Defensive publication**: Establishes invention date, prevents others from patenting
- **Trade secrets**: Protects specific implementations and techniques

**Both can coexist**:
- Publish the concept (defensive publication)
- Protect the implementation (trade secret)

See IP-PROTECTION-STRATEGY.md for details on the three-tier protection strategy.

---

## Ongoing Compliance

### Annual Review

Every January, we review:
- [ ] Trade secrets list (add/remove files as needed)
- [ ] Access control list (revoke access for departed collaborators)
- [ ] NDA compliance (ensure all NDAs are current)
- [ ] Security measures (update as needed)

### Per-File Review

When creating new files, ask:
- [ ] Does this file contain trade secret information?
- [ ] Should it be added to this list?
- [ ] Does it need confidential headers?
- [ ] Who should have access?

---

## Contact Information

**For Trade Secret Questions**:
- Email: kevin.weng.ai@gmail.com
- Subject: "Trade Secret Inquiry - [Your Name]"

**For Access Requests**:
- Email: kevin.weng.ai@gmail.com
- Subject: "Trade Secret Access Request - [Your Name]"
- Include: Business justification, intended use, duration

**To Report Breaches**:
- Email: kevin.weng.ai@gmail.com
- Subject: "URGENT - Trade Secret Breach Report"
- Include: Description of incident, parties involved, extent of disclosure

---

## Summary

### Quick Reference

| File | Contains | Access |
|------|----------|--------|
| dcaBacktestService.js | Core DCA algorithm | NDA required |
| portfolioBacktestService.js | Portfolio optimization | NDA required |
| batchBacktestService.js | Batch processing | NDA required |
| calculateBeta.js | Beta calculation | NDA required |
| performanceMetrics.js | Metrics algorithms | NDA required |

### Key Principles

1. **Confidentiality is paramount**: Never disclose without authorization
2. **NDA required for access**: All collaborators must sign
3. **Report breaches immediately**: Time is critical
4. **When in doubt, ask**: Better safe than sorry

---

**Last Updated**: January 2025
**Document Version**: 1.0
**Classification**: CONFIDENTIAL - TRADE SECRET
**Copyright © 2025 Kevin Weng. All Rights Reserved.**
