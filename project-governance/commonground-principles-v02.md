**CommonGround**

*Guiding Principles*

v0.2 · March 2026 · Supersedes Compact v0.1

I. Why This Exists

The data about our communities has always existed. The tools built from
it have not always served us.

Executives have dashboards. Landlords have platforms. Speculators have
algorithms. The institutions that shape our neighborhoods have long had
access to intelligence tools that let them make decisions --- about us,
without us. CommonGround is built to close that gap.

This is not a surveillance tool. It is a community nervous system ---
the capacity to sense what is happening, share that awareness laterally,
and coordinate response. Every design decision flows from that purpose.

II\. Core Values

Community Sovereignty

The communities represented by this data are its owners, not its
subjects. No design decision, data layer, or alert system will be built
without asking: does this strengthen the community\'s ability to act on
its own behalf?

Radical Transparency

Every data source is named. Every methodology is documented. Every
governance decision is logged publicly with its rationale. We have
nothing to hide because we are doing nothing that requires hiding.

Epistemic Honesty

This is one of CommonGround\'s most important commitments and is
elaborated fully in Section V. In brief: we will never allow the
platform\'s framing to do analytical work the data cannot support.
Correlations are labeled as correlations. Causal claims require primary
source evidence. Uncertainty is named, not buried.

Proportionality of Harm

Governance rights, alert confidence levels, and data layer decisions are
all calibrated to exposure to harm. The communities most at risk from a
given data layer have the most say in how it is used.

Decentralization as Design

No single entity --- including the founder --- should be able to control
or compromise CommonGround. The architecture, licensing, and governance
model all work toward a state of community sovereignty where the
platform belongs to no one and everyone.

The Solarpunk Commitment

For every hazard the platform reveals, we seek assets. For every threat,
a network. For every data point about what is being taken from
communities, a corresponding layer about what communities are building.
The platform succeeds when it makes people more capable, not more
afraid.

III\. Who This Serves

CommonGround is built for people and organizations working to strengthen
communities from within:

-   Mutual aid networks and crisis response groups

-   Tenant rights organizations and housing advocates

-   Neighborhood associations and block clubs

-   Food access and food justice organizers

-   Environmental justice advocates

-   Community health workers and harm reduction organizations

-   Peaceful assembly participants and legal observers

-   Local civic organizations and open government advocates

-   Anyone with a stake in a neighborhood and a desire to make it more
    resilient

CommonGround is explicitly not built for:

-   Real estate investors seeking displacement opportunity

-   Law enforcement, immigration enforcement, or any surveillance
    operation

-   Employers or landlords screening individuals

-   Any entity whose primary purpose is extractive rather than
    community-serving

*We acknowledge that open tools can be used by anyone. The above is a
statement of values and a governance framework, not a technical
restriction. Our architecture will make harmful use as difficult as
possible. We will not pretend it is impossible.*

IV\. What We Will Never Do

These are non-negotiable. They are not subject to community vote,
feature request, or governance process. They exist to protect the people
represented by the data.

No Individual Tracking

All data surfaces at aggregate level --- neighborhood, census tract, or
zip code minimum. The architecture enforces this technically. Policy
alone is insufficient.

No Data Sales or Sharing with Harmful Actors

CommonGround will never sell, license, or share its data --- including
aggregates, derived signals, or usage patterns --- with law enforcement,
immigration enforcement, real estate speculation interests, or any
extractive entity.

No Dark Patterns or Engagement Optimization

Alerts exist to prompt action, not anxiety. The platform is not
optimized for time-on-screen, emotional activation, or political
engagement for its own sake. CommonGround succeeds when communities need
it less, not more.

No Advertising, Ever

Not targeted, not contextual, not sponsored. The platform\'s incentives
must remain aligned with community benefit, not attention capture.

No Quiet Changes to These Commitments

Changes to this section require a public announcement, 30-day comment
period, and --- once the Stewardship Council exists --- unanimous
approval. The version history of this document is permanently public.

V. Epistemic Standards

This section governs how CommonGround represents knowledge. It is
binding on all alert copy, data layer descriptions, insight summaries,
and recommendation text.

The Three Claim Types

Every signal in CommonGround carries explicit metadata about what kind
of claim it is:

> **Correlation:** Two things tend to occur together. We do not know
> why. Knowing they co-occur is useful for anticipation, not
> explanation. Always use correlation language: \'is associated with,\'
> \'tends to co-occur with,\' \'has preceded in similar contexts.\'
> Never use: \'causes,\' \'leads to,\' \'results in.\'
>
> **Association with known mechanism:** A plausible causal pathway is
> supported by research, but local data does not prove it. We can speak
> with more confidence than bare correlation, but local application
> still requires humility. Always name the research basis and the
> limitation.
>
> **Documented cause:** Primary source evidence of a specific causal
> relationship in this place at this time. Example: a specific landlord
> filed 23 eviction notices in 60 days. This is not a correlation --- it
> is a documented actor taking a documented action. These claims can be
> made directly.

The Recommendation Chain

Before any alert surfaces a recommendation, it must complete this chain:

1.  What do we actually know? (documented facts only)

2.  What are the plausible explanations? (enumerate, do not collapse)

3.  What does the data let us distinguish between? (geographic
    clustering, actor concentration, temporal pattern)

4.  What action is proportionate to what we actually know? (match
    confidence of diagnosis to specificity of recommendation)

The recommendation must match the confidence level of the diagnosis. A
diffuse systemic pattern generates a different recommendation than a
concentrated actor pattern, even if the measured outcome is identical.

Why This Matters

Misrepresenting correlation as causation in a community intelligence
tool causes specific, predictable harms: it misidentifies who to hold
accountable, generates interventions aimed at symptoms rather than
sources, and erodes trust among communities that have been on the
receiving end of bad data-driven decisions.

In the current information environment, a tool that models epistemic
humility is itself a form of resistance.

VI\. Governance

CommonGround is governed in phases toward community sovereignty --- a
state where no single person or institution controls or compromises the
platform.

Phase 1: Founding (Current)

Single founder. Full decision-making authority except over Section IV
commitments. Obligations: all privacy-affecting decisions are publicly
documented; a decision log is maintained from day one; no proprietary
dependencies are introduced; codebase is AGPL-3.0 from first public
commit.

Phase 2: Stewardship Council

Formed before any real community deployment. Stewards hold veto power
over decisions that could harm represented communities. Selection
criteria: direct community work experience; geographic representation;
no affiliation with extractive industries; comfort with values, not
necessarily technology. Governance rights are proportional to exposure
to harm, not technical contribution.

Phase 3: Community Sovereignty

Federated local instances, each governed independently. No single-org
dependency. Foundation or fiscal sponsor structure. Documentation
sufficient for any community to fork, self-host, and govern
independently.

VII\. Licensing

**Codebase:** AGPL-3.0. All modifications must be released under the
same license.

**Data outputs:** CC BY-SA 4.0. Share freely, attribute the community,
keep it open.

**These principles:** CC0 1.0. No rights reserved. Take them, adapt
them, use them.

**Community contributions:** CC BY 4.0 by default, with explicit consent
at point of contribution.

***The people know their neighborhoods. CommonGround helps them act on
what they already know.***

v0.1: Initial Compact, March 2026. v0.2: Expanded epistemic standards,
protest safety layer rationale, solarpunk commitment formalized.
