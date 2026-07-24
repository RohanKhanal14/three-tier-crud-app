# Three-Tier CRUD App: Master DevSecOps CI/CD Integration and Operations Guide

> **Repository:** `RohanKhanal14/three-tier-crud-app`
>
> **Application:** React + Vite frontend, Nginx, Node.js + Express backend, MongoDB
>
> **Delivery:** GitHub, Jenkins controller/agent, SonarQube, Trivy, Docker Hub or ECR, Argo CD, Helm, Minikube or EKS
>
> **Observability:** Prometheus, Grafana, Loki, Grafana Alloy, Alertmanager
>
> **Security testing:** SonarQube, Trivy, OWASP ZAP
>
> **Revision date:** 2026-07-23
>
> **Status:** Canonical merged guide and configuration audit

This is the single master document for the project. It replaces the two supplied drafts:

- “Production-Grade DevSecOps CI/CD Pipeline (Teaching & Testing Edition)”
- “Production-grade DevSecOps CI/CD pipeline — Jenkins Controller-Agent + GitHub + SonarQube + …”

The drafts were evaluated, de-duplicated, checked against the current repository, and updated for July 2026. Do not concatenate or follow the source drafts independently; both contain deployment-breaking examples and outdated components.

## Table of contents

1. [How to use this guide](#1-how-to-use-this-guide)
2. [Consolidated evaluation](#2-consolidated-evaluation-of-the-two-source-documents)
3. [Current repository contract](#3-current-repository-contract)
4. [Configuration defect register](#4-configuration-defect-register)
5. [Canonical technical decisions](#5-canonical-technical-decisions)
6. [Architecture and trust boundaries](#6-target-architecture-and-trust-boundaries)
7. [Version and configuration policy](#7-version-and-configuration-policy)
8. [Phase 0 repository corrections](#8-phase-0--make-the-repository-internally-consistent)
9. [Infrastructure and networking](#9-infrastructure-sizing-and-network-model)
10. [Jenkins controller](#10-jenkins-controller-setup)
11. [Jenkins agent](#11-jenkins-agent-setup)
12. [Controller-agent connection](#12-connect-jenkins-controller-to-the-agent)
13. [GitHub](#13-github-setup)
14. [SonarQube](#14-sonarqube-setup-and-quality-gate)
15. [Registry and artifacts](#15-registry-setup-and-artifact-policy)
16. [Corrected Jenkins pipeline contract](#16-corrected-jenkins-pipeline-contract)
17. [GitOps and Helm](#17-gitops-repository-and-helm-chart)
18. [Kubernetes workloads](#18-kubernetes-workload-requirements)
19. [Minikube lab](#19-minikube-lab-track)
20. [Amazon EKS production](#20-amazon-eks-production-track)
21. [Argo CD](#21-argo-cd-installation-and-gitops-operation)
22. [Secrets](#22-secret-management)
23. [Prometheus, Grafana, and alerts](#23-prometheus-grafana-and-alerting)
24. [Loki and Alloy](#24-loki-and-grafana-alloy-logging)
25. [Application security gaps](#25-application-security-and-reliability-gaps)
26. [OWASP ZAP](#26-owasp-zap-dynamic-testing)
27. [Jenkins email](#27-jenkins-email-notifications)
28. [End-to-end UI runbook](#28-end-to-end-acceptance-and-ui-runbook)
29. [Promotion, rollback, and recovery](#29-promotion-rollback-and-recovery)
30. [Troubleshooting](#30-troubleshooting-matrix)
31. [Teardown and cost](#31-teardown-and-cost-control)
32. [Definition of done](#32-definition-of-done)
33. [Official references and maintenance](#33-official-references-and-maintenance)

---

## 1. How to use this guide

There are two supported profiles:

| Profile | Purpose | Runtime | Registry | Database | Support statement |
|---|---|---|---|---|---|
| **Lab** | Teaching, demos, integration testing | Minikube on an isolated Jenkins-agent EC2 instance | Docker Hub or ECR | Single-node MongoDB in Kubernetes | Not production; no untrusted fork builds |
| **Production** | Real workload | Amazon EKS in private subnets | ECR | MongoDB Atlas, or deliberately validated Amazon DocumentDB | IaC, managed storage, TLS, SSO, least privilege, HA |

Shared CI setup appears once. Profile-specific differences appear only in the Lab and Production chapters.

### 1.1 Important language

- **Current** means the setting exists in this repository now.
- **Required correction** means integration should stop until it is fixed.
- **Target** means the corrected desired design described by this guide.
- Values in angle brackets, such as `<AWS_ACCOUNT_ID>`, are placeholders. Never copy them literally.
- Commands beginning with `aws`, `kubectl`, `helm`, `argocd`, or destructive cleanup commands must be run only after confirming the active account, region, and cluster context.

### 1.2 Safety rules

1. Never put passwords, tokens, MongoDB URIs, private keys, or webhook secrets in Git.
2. Never run untrusted pull-request code on the Jenkins controller.
3. Never give Jenkins production cluster-admin credentials.
4. Never run an active ZAP full scan against production.
5. Never expose Jenkins, Argo CD, Prometheus, Grafana, or SonarQube using an unauthenticated `0.0.0.0` port-forward.
6. Never deploy the raw `k8s/` manifests and an Argo-managed Helm release into the same namespace. That creates competing owners and drift.
7. Use Git revert as the normal rollback. A manual `kubectl rollout undo` is an emergency action that must be reconciled back into Git.

---

## 2. Consolidated evaluation of the two source documents

### 2.1 What was retained

The teaching draft supplied the better Minikube sequence, Jenkins UI detail, separate pipeline approach, ZAP explanation, email guidance, dashboard workflow, and troubleshooting structure.

The production draft supplied the better EKS architecture, ECR/IAM model, managed database direction, HPA/PDB/NetworkPolicy concepts, External Secrets direction, digest-promotion idea, scaling model, and production hardening checklist.

The master design keeps:

- separate frontend and backend Jenkins jobs;
- Jenkins as CI and GitOps updater;
- Argo CD as the only Kubernetes CD controller;
- Docker Hub only as an optional lab registry;
- ECR as the AWS production registry;
- raw Kubernetes YAML only as a lab learning path;
- a separate GitOps repository with a Helm chart as the target delivery path;
- JSON logs to stdout, Prometheus metrics, Loki, Grafana, and alerts;
- ZAP only after the intended staging deployment is healthy.

### 2.2 What was removed or corrected

- Repeated architecture, installation, Argo CD, monitoring, rollback, and checklist sections were merged.
- Promtail was replaced with Grafana Alloy. Promtail reached end of life on 2026-03-02.
- Node.js 20 was marked unsupported. It reached end of life on 2026-03-24.
- Kubernetes 1.32 pins were removed. The currently supported upstream branches at this revision are 1.34–1.36; select a version supported by the chosen EKS/Minikube release.
- The retired community Ingress NGINX controller was removed from the target
  lab design. It stopped receiving releases and security fixes on 2026-03-24.
  The lab target uses Gateway API with a pinned maintained controller; EKS uses
  AWS Load Balancer Controller.
- The obsolete Jenkins 2023 signing key was replaced by the current 2026 key.
- “Argo CD runs `helm upgrade`” was corrected: Argo CD uses Helm to render manifests, then Argo CD applies and owns the resources.
- Argo CD UI rollback was no longer presented as compatible with automatic sync. Argo CD does not permit rollback while automated sync is enabled.
- Prometheus, NetworkPolicy, Ingress, secrets, image-digest, ZAP, and Jenkins credential examples were corrected in the relevant chapters.

---

## 3. Current repository contract

The repository is the authority for paths, scripts, ports, routes, service names, and report locations.

### 3.1 Repository layout at audit time

```text
three-tier-crud-app/
├── backend/
│   ├── src/server.js
│   ├── tests/items.test.js
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   ├── sonar-project.properties
│   └── .dockerignore                 # present locally, currently ignored by Git
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/
│   │   ├── services/api.js
│   │   └── tests/components.test.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   ├── package.json
│   ├── package-lock.json
│   ├── sonar-project.properties
│   └── .dockerignore                 # present locally, currently ignored by Git
├── jenkins/
│   ├── Jenkinsfile-backend
│   └── Jenkinsfile-frontend
├── k8s/
│   ├── apply-all.sh
│   ├── README.md                     # untracked at audit time
│   ├── backend/
│   ├── frontend/
│   ├── db/
│   └── network/                      # untracked at audit time
├── docker-compose.yml
├── build-and-push.sh
├── README.md
└── projectfile.md                    # this document
```

Audit context:

```text
Git branch: k8s
Base commit: 0649b3c
Remote: git@github.com:RohanKhanal14/three-tier-crud-app.git
```

The working tree contained user changes during the audit. This document describes the files as inspected; it does not claim that the base commit alone contains all inspected files.

### 3.2 Application contract

| Concern | Current source | Current value |
|---|---|---|
| Backend port | `backend/src/server.js` | `PORT`, default `5000` |
| MongoDB | `backend/src/server.js` | `MONGO_URI`, default local URI |
| Runtime mode | `backend/src/server.js` | `NODE_ENV`, default `development` |
| CORS | `backend/src/server.js` | `CORS_ORIGIN`, default `*` |
| Log identity | `backend/src/server.js` | `SERVICE_NAME`, default `crud-backend` |
| Log threshold | `backend/src/server.js` | `LOG_LEVEL`, default `info` |
| API | `backend/src/server.js` | `/api/items`, `/api/items/:id` |
| Readiness-style health | `backend/src/server.js` | `/health`, includes MongoDB state |
| Metrics | `backend/src/server.js` | `/metrics` |
| Metric prefix | `backend/src/server.js` | `crud_app_` |
| Frontend container port | `frontend/nginx.conf` | `8080` |
| Browser API base | `frontend/src/services/api.js` | empty string; same-origin `/api` |
| Nginx upstream | `frontend/nginx.conf` | `backend-svc:5000` |
| Vite dev port | `frontend/vite.config.js` | `3000` |
| Vite dev upstream | `frontend/vite.config.js` | currently `backend-svc:5000`, incorrect outside Kubernetes |
| Compose browser URL | `docker-compose.yml` | `http://localhost:3000` |
| Raw K8s frontend Service | `k8s/frontend/fe-svc.yaml` | `frontend-svc:80` → pod `8080` |
| Raw K8s backend Service | `k8s/backend/be-svc.yaml` | `backend-svc:5000` |
| Raw K8s Ingress host | `k8s/network/ingress.yaml` | `myapp.local` |

### 3.3 Verified local results

The following was actually run during this audit:

| Check | Result |
|---|---|
| Backend syntax | Passed |
| Backend tests | 20/20 passed |
| Backend coverage | Tests pass, but report is 0% because `server.js` is excluded |
| Frontend tests | 12/12 passed |
| Frontend reported coverage | 83.56% statements for only three imported component files |
| Frontend production build | Passed |
| Frontend LCOV | Missing; SonarQube expects `coverage/lcov.info` |
| `npm audit` including dev dependencies | 0 known advisories for both lock files on 2026-07-23 |
| Kubernetes server-side validation | Not completed; the configured local Minikube API was unavailable from the audit sandbox |

Passing tests do not mean the delivery configuration is ready. The next section lists release blockers.

---

## 4. Configuration defect register

Resolve all **Blocker** items before claiming the pipeline is integrated.

| Severity | Area | Finding | Required correction |
|---|---|---|---|
| Blocker | Runtime | Both Dockerfiles use EOL `node:20-alpine` | Test and migrate to Node 24 LTS; pin an image digest |
| Blocker | Jenkins frontend | `agent any` can execute builds on the controller | Use one dedicated agent label; set controller executors to `0` |
| Blocker | Jenkins frontend | ECR mode references undefined `AWS_ACCOUNT_ID`, `AWS_REGION`, `ECR_REPO` | Define and validate them or remove the unused mode |
| Blocker | Jenkins frontend | SonarQube Quality Gate is commented out | Enable `waitForQualityGate abortPipeline: true` |
| Blocker | Both pipelines | `npm run lint` only prints “No linter configured” | Install/configure ESLint and fail on warnings |
| Blocker | Frontend Sonar | Pipeline expects LCOV, but Vitest does not generate it | Add `lcov` reporter and all-source coverage inclusion |
| Blocker | Backend Sonar | Jest excludes the only source file, producing 0% | Include `src/server.js` or split app startup from testable modules |
| Blocker | Sonar integration | No SonarQube webhook to Jenkins is documented/configured | Add `<JENKINS_URL>/sonarqube-webhook/` and verify delivery |
| Blocker | Both pipelines | Credentialed branch boundaries are incomplete: frontend guards are commented and backend branch builds can push images | PRs run validation only; restrict registry, GitOps, Argo, SMTP, and ZAP credentials to trusted deployment branches |
| Blocker | Both pipelines | ZAP forces a successful shell result, so execution and findings cannot fail the job | Remove the suppression, implement explicit exit-code policy, and archive reports even on failure |
| Blocker | Both pipelines | ZAP targets `localhost`, but no app is started and no Argo wait occurs | Wait for exact deployed digest, then scan the real staging URL |
| Blocker | Registry | ECR is configured immutable while pipelines push mutable `latest` | Never push `latest` to immutable ECR; push unique tags and deploy a digest |
| Blocker | GitOps security | Token is embedded in `git clone` URL and `.git/config` | Use GitHub App/deploy key or Jenkins `gitUsernamePassword` binding |
| Blocker | GitOps consistency | Frontend/backend jobs can race on one values file | Serialize updates and retry/rebase, or split image value files |
| Blocker | GitOps availability | Referenced GitOps Helm repo is not part of this repository | Create and validate the second repo before enabling mutation stages |
| Blocker | Local frontend | Vite proxy points to Kubernetes-only `backend-svc` | Use `http://localhost:5000` for host development |
| Blocker | Compose | Nginx expects `backend-svc`, Compose provides only `backend` | Add the network alias `backend-svc` or standardize the name |
| Blocker | Compose | Builds are commented, so local source is ignored | Restore `build.context` or explicitly document image-only behavior |
| Blocker | Docker build context | `.gitignore` excludes `.dockerignore` files | Stop ignoring them and commit both files |
| Blocker | Raw K8s DB | StatefulSet is missing `spec.serviceName` | Add a governing headless Service and `serviceName`, or use a Deployment for the lab |
| Blocker | Raw K8s entry point | Current manifests and Minikube instructions rely on retired Ingress NGINX | Migrate the lab to Gateway API with a maintained pinned controller; keep AWS Load Balancer Controller for EKS |
| Blocker | NetworkPolicy | Ingress sends API to backend, but backend accepts only frontend Pods | Route all public traffic to frontend/Nginx, or explicitly allow the ingress data path |
| Blocker | Monitoring policy | Default deny blocks Prometheus from backend | Allow the monitoring namespace/Prometheus pods to backend port 5000 |
| Blocker | Exposure | `/metrics` is publicly routed by Ingress | Remove public `/metrics`; scrape through ClusterIP |
| High | Pipeline images | Jenkins, Compose, and raw Kubernetes use inconsistent repositories/tags for both services; the frontend alone has three identities | Define one image repository per service per profile and record the digest |
| High | Pipeline tagging | Image tag can be calculated before a reliable short SHA exists | Compute it after checkout with `git rev-parse --short=8 HEAD` |
| High | Frontend cleanup | Post blocks are duplicated and fully commented | Replace them with one active, targeted cleanup/report block |
| High | Frontend concurrency | Concurrent builds are allowed | Enable job concurrency control and protect GitOps updates globally |
| High | Nginx headers | Static location overrides inherited `add_header` directives | Apply security headers consistently; test actual asset responses |
| High | Kubernetes | Services are NodePort even though Ingress exists | Use ClusterIP in the target Helm chart |
| High | Kubernetes | Deployments lack resources and Pod security controls | Add requests, limits, non-root, seccomp, dropped capabilities, and token controls |
| High | Raw K8s source | `k8s/README.md` and `k8s/network/` are untracked while the apply script depends on the network files | Review/fix and commit the documentation, policies, ingress, and script together |
| High | Health design | Backend liveness uses DB-dependent `/health` | Use a process-only liveness endpoint or TCP liveness; keep `/health` for readiness |
| High | Prometheus | Draft alert used `http_requests_total`, but app emits `crud_app_http_requests_total` | Use the actual metric and calculate an error ratio |
| High | Logging | Frontend Nginx access logs are not structured for Loki | Emit JSON access logs to stdout and propagate `X-Request-ID` |
| High | Secrets | Drafts put MongoDB passwords on command lines/in YAML | Use Jenkins credentials, Kubernetes Secret for lab, External Secrets for production |
| High | Argo rollback | Drafts instruct UI rollback while auto-sync is on | Use Git revert; disable auto-sync temporarily only for an approved emergency |
| High | Tool lifecycle | Drafts install Promtail, Node 20, Kubernetes 1.32 | Use Alloy, Node 24 LTS, and a supported Kubernetes minor |
| Medium | Build script | `build-and-push.sh` defaults to root context with `backend/Dockerfile` | Default `BUILD_CONTEXT=backend`, or pass it explicitly |
| Medium | Pipeline validation | Registry mode can fall through silently and required tools/variables are not uniformly validated | Allow-list registry modes and fail preflight on every missing command or variable |
| Medium | Jenkins email | Backend coverage link/report assumptions are wrong and success text can claim a deployment on a skipped branch | Publish the real `coverage/lcov-report/index.html` path and build messages from stages that actually ran |
| Medium | Naming | Files use the typo `deployement` | Rename deliberately with Git and update all references |
| Medium | CORS | Raw K8s config says `localhost:3000` while Ingress uses another host | Prefer same-origin frontend proxy; set an exact external origin only when needed |
| Medium | Docs/code | README ports and current Compose ports differ | Make `3000` the documented Compose frontend port |

### 4.1 Claims that must not be made yet

The repository does **not** currently implement image signing, SBOM publication, admission policy, digest deployment, a production approval gate, a complete Helm chart, External Secrets, or an EKS platform. These are target controls, not enabled controls.

---

## 5. Canonical technical decisions

1. The frontend image is environment-neutral and uses relative `/api` requests.
2. The only public application route goes to Nginx. In the lab a maintained
   Gateway API controller routes to it; in EKS AWS Load Balancer Controller
   routes to it. Nginx proxies `/api/` to `backend-svc:5000`.
3. The backend and database remain ClusterIP-only.
4. `/metrics` is internal and scraped by a ServiceMonitor.
5. Jenkins creates immutable artifacts and updates GitOps desired state.
6. Argo CD renders the Helm chart and reconciles Kubernetes.
7. PR jobs do not receive registry-write, GitOps-write, SMTP, Argo, or production secrets.
8. Deployment branches use immutable tags; production records and deploys the image digest.
9. Minikube raw manifests and the production Helm release are different tracks.
10. Grafana Alloy collects logs. Promtail must not be newly installed.
11. MongoDB in Kubernetes is lab-only. Prefer MongoDB Atlas for MongoDB behavior in production. Treat DocumentDB as a different compatible service and test its documented functional differences and TLS requirements.

---

## 6. Target architecture and trust boundaries

### 6.1 Shared CI and GitOps flow

```text
Developer
   │ push / pull request
   ▼
GitHub application repository
   │ webhook over HTTPS
   ▼
Jenkins controller (coordination only; 0 executors)
   │ SSH agent launch
   ▼
Dedicated Jenkins agent
   ├── npm ci
   ├── ESLint
   ├── tests + coverage + JUnit
   ├── SonarQube analysis → webhook → Quality Gate
   ├── Trivy filesystem/secret/config scan
   ├── application build
   ├── container build
   ├── Trivy image scan + SBOM (target)
   ├── registry push of unique tag
   ├── resolve digest
   └── safe GitOps commit
             │
             ▼
       GitHub GitOps repository
             │ pull/reconcile
             ▼
          Argo CD
             │ render Helm + apply resources
             ▼
       Minikube lab or EKS production
             │
             ├── wait for Synced + Healthy + expected digest
             └── ZAP scan staging endpoint
```

### 6.2 Application request path

```text
Browser
  │ HTTPS /
  ▼
Gateway / ALB
  │ all application paths
  ▼
frontend-svc:8080
  ▼
Nginx pod:8080
  ├── / and static files → React bundle
  └── /api/* → backend-svc:5000
                    ▼
              Express backend
                    ▼
          MongoDB lab / managed DB
```

This path matches the current relative Axios URLs and Nginx proxy. It also makes “backend only from frontend” NetworkPolicy meaningful.

### 6.3 Observability flow

```text
Backend JSON stdout ─┐
Nginx JSON stdout ───┼─→ Kubernetes logs → Grafana Alloy → Loki → Grafana Explore

Backend /metrics → ServiceMonitor → Prometheus → Grafana dashboards / Alertmanager
Cluster metrics  → kube-prometheus-stack ──────┘
```

### 6.4 Lab trust warning

The teaching design may place Docker, the Jenkins agent, Minikube, Argo CD,
MongoDB, and monitoring on one EC2 host. Membership in the Docker group is
effectively root access. A malicious Jenkins build could control the host and
cluster. Use this only with trusted code and disposable data.

Production agents must be separate, isolated, and preferably ephemeral. They must not share a Docker daemon or node with application workloads.

Branch conditions inside a Jenkinsfile are not a security boundary. Jenkins
loads pipeline code from the proposed revision before evaluating `when`.
Therefore, an untrusted pull request that runs on a Docker-enabled agent with an
EC2 role can replace the Jenkinsfile and steal the role or control the host,
even when every deploy stage has a `when` guard.

Use two execution classes:

| Pipeline | Agent capabilities | Credentials | Allowed work |
|---|---|---|---|
| Untrusted PR validation | Ephemeral, unprivileged, no Docker socket, no production network path, no EC2 deployment role | Read-only checkout only | install, lint, unit tests, source build, safe source scanning |
| Trusted delivery | Dedicated privileged agent; reviewed Jenkinsfile from a protected ref or trusted shared library | Registry/GitOps/Argo permissions scoped to the environment | container build/scan/push and GitOps promotion |

Fork PRs must never select the privileged label. If container validation is
required for a PR, use a rootless or isolated builder with no reusable secrets
and no host socket. Approving a PR build is a trust decision; it is not merely a
way to make a red check green.

---

## 7. Version and configuration policy

### 7.1 Version matrix

Record exact tested versions in the implementation pull request. Do not silently use `latest`.

| Component | July 2026 baseline | Policy |
|---|---|---|
| Jenkins Java | Java 21 or later | Use the version supported by the installed Jenkins release |
| Application Node.js | Node 24 LTS | Node 20 is EOL; test dependencies before changing images |
| Kubernetes | Supported minor, currently 1.34–1.36 upstream | EKS, kubectl, and add-ons must satisfy version-skew rules |
| MongoDB lab | Major 7 currently in repo | Pin patch/digest after testing |
| Jenkins | LTS from official Debian stable repository | Back up before upgrades |
| Trivy | v0.70.0 worked example | Pin and verify release asset/provenance; update DB in CI |
| SonarScanner | Pinned supported release | Prefer Jenkins tool configuration |
| Helm | v4.2.3 worked example | Pin and verify archive; test chart/plugin compatibility |
| yq | v4.53.2 worked example | Mike Farah binary; pin and verify checksum |
| Argo CD | v3.4.2 worked example | Pin server chart and compatible CLI; review release notes |
| Lab north-south controller | Envoy Gateway v1.8.3 worked example | Pin/review compatibility; do not install retired Ingress NGINX |
| kube-prometheus-stack | Pinned chart version | Store values and chart version in GitOps |
| Loki | Pinned community chart | Lab: Monolithic; production: S3-backed supported topology |
| Grafana Alloy | Pinned chart version | Replace Promtail |
| ZAP | Pinned image digest | Do not use mutable `:stable` for reproducible gates |

Current authoritative lifecycle references:

- Node.js releases: <https://nodejs.org/en/about/previous-releases>
- Kubernetes version skew: <https://kubernetes.io/releases/version-skew-policy/>
- Jenkins Debian installation: <https://www.jenkins.io/doc/book/installing/linux/>
- Promtail EOL: <https://grafana.com/docs/loki/latest/send-data/promtail/>

### 7.2 Canonical names

Use these consistently in the target configuration:

| Item | Canonical value |
|---|---|
| Application repo | `three-tier-crud-app` |
| GitOps repo | `three-tier-gitops` |
| Jenkins backend job | `crud-backend` |
| Jenkins frontend job | `crud-frontend` |
| Jenkins agent label | `devsecops-agent` |
| Sonar projects | `crud-backend`, `crud-frontend` |
| Lab namespace | `three-tier-lab` |
| GitOps environment namespaces | `three-tier-dev`, `three-tier-staging`, `three-tier-prod` |
| Monitoring namespace | `monitoring` |
| Loki namespace | `loki` |
| Alloy namespace | `alloy` |
| Argo namespace | `argocd` |
| Frontend Service | `frontend-svc` |
| Backend Service | `backend-svc` |
| MongoDB governing Service | `mongodb-svc` |
| Lab GatewayClass | `eg` |
| Lab host | `lab.crud.local` |
| Backend log service | `crud-backend` |

### 7.3 Current credential drift

The current Jenkinsfiles do not agree:

| Purpose | Backend file expects | Frontend file expects | Target ID |
|---|---|---|---|
| Docker Hub | `dockerhub-creds` | `docker-hub` | `dockerhub-creds` |
| GitOps write | `github-gitops-token` | `gitops` | `github-gitops-write` |
| Sonar server config | `sonarqube-server` | `sonarqube-server` | `sonarqube-server` |

Normalize the Jenkinsfiles before creating credentials. Do not create duplicate long-lived secrets merely to accommodate drift.

Target credential inventory:

| ID | Jenkins type | Scope | Used by |
|---|---|---|---|
| `github-app-read` | GitHub App or username/token | Folder/job read only | Branch discovery and checkout |
| `github-gitops-write` | SSH username/private key | Trusted deployment jobs only | GitOps commit/push |
| `dockerhub-creds` | Username/password where password is access token | Lab jobs only | Docker Hub push |
| `sonarqube-token` | Secret text | Analysis jobs | SonarQube |
| `sonarqube-webhook-secret` | Secret text | Jenkins/Sonar global config | Verify Sonar callback |
| `smtp-notifier` | Username/password | Notifications only | Email Extension |
| `argocd-staging-read-token` | Secret text | Staging verification only | `argocd app wait/get` |

AWS static access keys are not part of this inventory. Use the Jenkins agent EC2 role or workload identity.

---

## 8. Phase 0 — make the repository internally consistent

Do this before creating cloud infrastructure. The current pipelines should not be enabled for automatic deployment until this phase passes.

### 8.1 Commit Docker ignore files

Current `.gitignore` ignores `.dockerignore`, so clean Jenkins checkouts do not receive the service-specific build exclusions.

Required change:

```diff
- .dockerignore
```

Then:

```bash
git add backend/.dockerignore frontend/.dockerignore .gitignore
git status --short
```

Expected: both `.dockerignore` files appear as tracked additions or modifications. Inspect them and confirm they exclude `.env`, `node_modules`, coverage, Git metadata, and local build output.

### 8.2 Move to supported Node.js

After running tests under Node 24, change both Dockerfile stages from `node:20-alpine` to an approved Node 24 Alpine patch image pinned by digest. Update the Jenkins agent to Node 24 as well.

Do not change only the agent. The runtime image is the production runtime.

Verification:

```bash
node --version
npm --version
cd backend && npm ci && npm run test:coverage
cd ../frontend && npm ci && npm test -- --coverage && npm run build
```

While updating the images:

- copy `package-lock.json` explicitly; `npm ci` requires it, so
  `package-lock.json*` falsely implies it is optional;
- remove the backend builder stage unless it produces a real artifact;
- use `npm ci --omit=dev` for the runtime dependency tree and review lifecycle
  scripts before considering `--ignore-scripts`;
- create an explicit numeric backend UID/GID and declare it with `USER`;
- keep frontend static assets root-owned and read-only;
- pin both runtime/base images by tested patch and digest;
- use BuildKit cache plus `--pull` rather than `--no-cache` on every build;
- make container health checks process-only; Kubernetes readiness owns the
  database-dependency check.

### 8.3 Replace fake lint stages

Both `package.json` files currently define:

```json
"lint": "echo 'No linter configured'"
```

Add a real ESLint configuration compatible with the React and Node code. The CI command must be deterministic:

```json
"lint": "eslint . --max-warnings=0"
```

Minimum rules:

- recommended JavaScript rules;
- Node/CommonJS environment for backend;
- browser/ES module and React Hooks rules for frontend;
- ignore `node_modules`, `coverage`, `dist`, and generated reports.

Run:

```bash
npm run lint
```

Expected: exit `0` with actual source files examined. A line that only prints a message is not a security or quality gate.

### 8.4 Correct coverage and test publishing

Backend:

- Remove `!src/server.js` from Jest `collectCoverageFrom`, or split `app.js` from `server.js` so importable application logic is measured.
- Keep `require.main === module` around startup so tests do not open the production listener.
- Add `jest-junit` and generate a Jenkins-compatible report at
  `backend/reports/junit.xml`.
- Keep `jest-sonar-reporter` only for `backend/test-report.xml`; Sonar Generic
  Test Execution XML is not JUnit and Jenkins must not publish it as JUnit.

Backend Jest target:

```json
{
  "reporters": [
    "default",
    [
      "jest-junit",
      {
        "outputDirectory": "reports",
        "outputName": "junit.xml"
      }
    ]
  ]
}
```

Frontend `vite.config.js` target:

```js
test: {
  globals: true,
  environment: 'jsdom',
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'lcov', 'json'],
    include: ['src/**/*.{js,jsx}'],
    exclude: ['src/tests/**', 'src/main.jsx'],
    thresholds: {
      statements: 70,
      branches: 65,
      functions: 70,
      lines: 70,
    },
  },
},
```

Vitest has a built-in JUnit reporter. Add to the test configuration:

```js
reporters: ['default', 'junit'],
outputFile: {
  junit: './reports/junit.xml',
},
```

Create `reports/` before the test command and configure Jenkins to publish
`frontend/reports/junit.xml`. Do not use `allowEmptyResults: true` for a report
that is required.

Verification:

```bash
test -s backend/coverage/lcov.info
test -s backend/reports/junit.xml
test -s frontend/coverage/lcov.info
test -s frontend/reports/junit.xml
```

In Jenkins, the expected result is a **Test Result** link and trend, not only archived HTML.

### 8.5 Keep the frontend image environment-neutral

The current browser API client correctly makes same-origin calls:

```js
const API_BASE_URL = '';
```

The Dockerfile and Jenkinsfile nevertheless pass `VITE_API_BASE_URL`; it is unused. Remove the unused build argument and Jenkins environment variable unless the application deliberately adopts it.

Do not set it to a value ending in `/api` while API calls also begin with `/api`; that would produce `/api/api/items`.

Correct the host-development proxy in `frontend/vite.config.js`:

```js
proxy: {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  },
},
```

### 8.6 Make Compose build this repository

The target Compose service configuration is:

```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
  image: three-tier-crud-backend:local
  networks:
    crud-network:
      aliases:
        - backend-svc

frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
  image: three-tier-crud-frontend:local
```

The network alias allows the current Nginx `proxy_pass http://backend-svc:5000`.

Validate without starting:

```bash
docker compose config
```

Start and verify:

```bash
docker compose up --build -d
docker compose ps
curl --fail http://localhost:5000/health
curl --fail http://localhost:3000/
curl --fail http://localhost:3000/api/items
```

Open `http://localhost:3000`. Create, update, filter, and delete an item. In another terminal:

```bash
docker compose logs --since=5m backend
docker compose logs --since=5m frontend
```

Expected backend log lines are single JSON objects containing `timestamp`, `level`, `service`, `event`, and `request_id`.

### 8.7 Correct Nginx for health, headers, and Loki

Add a dedicated `/healthz` that does not serve the SPA. Add JSON access logging to stdout and propagate request IDs.

Target server concepts:

```nginx
map $http_x_request_id $correlation_id {
    default $request_id;
    "~^[A-Za-z0-9._-]{1,128}$" $http_x_request_id;
}

# Trust this value only when NetworkPolicy/security groups make the Gateway or
# ALB the sole caller of Nginx.
map $http_x_forwarded_proto $forwarded_proto {
    default $scheme;
    "~^(http|https)$" $http_x_forwarded_proto;
}

log_format loki_json escape=json
  '{"timestamp":"$time_iso8601","level":"info","service":"crud-frontend",'
  '"event":"http_request_completed","request_id":"$correlation_id",'
  '"http":{"method":"$request_method","uri":"$uri","status_code":$status,'
  '"duration_seconds":$request_time,"upstream_status":"$upstream_status",'
  '"upstream_duration_seconds":"$upstream_response_time","bytes":$body_bytes_sent}}';

access_log /dev/stdout loki_json;
error_log /dev/stderr warn;
server_tokens off;

add_header X-Request-ID $correlation_id always;

location = /healthz {
    access_log off;
    default_type text/plain;
    return 200 "healthy\n";
}

location /api/ {
    proxy_pass http://backend-svc:5000;
    proxy_set_header X-Request-ID $correlation_id;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $forwarded_proto;
    proxy_set_header Host $host;
    proxy_hide_header X-Request-ID;
}
```

Define the complete reviewed security-header set at server scope. A
location-level `add_header`—including a cache header—prevents all normal
inheritance, so repeat/include the complete set in every location that defines
one. The server-level request-ID header above covers `/`, assets, `/healthz`,
and `/api`; `proxy_hide_header` prevents a duplicate backend copy. Test headers
on all path classes:

```bash
curl -sSI http://localhost:3000/
curl -sSI http://localhost:3000/assets/<ACTUAL_FILE>.js
curl -sSI http://localhost:3000/healthz
curl -sSI http://localhost:3000/api/items
```

Remove the obsolete `X-XSS-Protection: 1; mode=block`; modern policy may explicitly set `X-XSS-Protection: 0`. Remove `script-src 'unsafe-inline'` if the built bundle works without it. Terminate TLS and add HSTS at the production ingress/ALB layer.
With the same-origin API design, use `connect-src 'self'`; remove the current
browser-visible `http://localhost:5000` and `http://backend:5000` allowances.
Ensure exactly one `X-Request-ID` response header is emitted: Nginx hides any
upstream copy and returns the validated/generated correlation value itself.
Only enable Express `trust proxy` for the exact trusted proxy topology; never
trust arbitrary client-supplied forwarding headers. ALB terminates HTTPS before
Nginx, so replacing its validated `X-Forwarded-Proto: https` with Nginx’s
`$scheme` would incorrectly report `http`.

### 8.8 Correct raw Kubernetes manifests

Before using `k8s/`:

- add namespace creation;
- make `apply-all.sh` resolve paths from its own directory;
- add `spec.serviceName: mongodb-svc` to the StatefulSet;
- make the governing MongoDB Service headless (`clusterIP: None`) for StatefulSet identity;
- use ClusterIP for frontend and backend when Ingress is enabled;
- align the frontend image tag with the pipeline;
- add resources, security contexts, probes, and standard labels;
- change frontend probes to `/healthz`;
- use backend TCP liveness and `/health` readiness until a process-only `/live` endpoint exists;
- replace the retired Ingress NGINX resource with Gateway API `Gateway` and
  `HTTPRoute` resources targeting only frontend port `8080`;
- replace the current ingress-nginx NetworkPolicy selector with the actual
  selected Gateway data-plane namespace and labels;
- remove `/metrics` and direct `/api` from the public route because Nginx owns
  same-origin proxying;
- add a monitoring-to-backend NetworkPolicy;
- restrict DNS egress to kube-dns rather than every namespace on port 53.

Do not run the script from an arbitrary working directory until it uses:

```bash
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
```

### 8.9 Fix the standalone build helper

`build-and-push.sh` currently defaults to:

```text
Dockerfile: backend/Dockerfile
Build context: .
```

That Dockerfile expects `package.json` in its build context, but the root has no `package.json`. Set:

```bash
BUILD_CONTEXT="${BUILD_CONTEXT:-backend}"
```

or always invoke:

```bash
BUILD_CONTEXT=backend \
DOCKERFILE=backend/Dockerfile \
APP_VERSION=v1.0.0 \
DOCKERHUB_USERNAME=<USER> \
./build-and-push.sh
```

### 8.10 Phase 0 exit gate

All must pass:

```bash
git diff --check
docker compose config
(cd backend && npm ci && npm run lint && npm run test:coverage)
(cd frontend && npm ci && npm run lint && npm test -- --coverage && npm run build)
test -s backend/coverage/lcov.info
test -s frontend/coverage/lcov.info
```

Also manually complete one CRUD lifecycle through `http://localhost:3000`.

---

## 9. Infrastructure sizing and network model

### 9.1 Lab placement

| Host | Minimum | Recommended | Workloads |
|---|---:|---:|---|
| EC2-A | 2 vCPU / 4 GiB / 50 GiB gp3 | 2 vCPU / 8 GiB | Jenkins controller only |
| EC2-B | 4 vCPU / 16 GiB / 100 GiB gp3 | 8 vCPU / 32 GiB | Trusted Jenkins agent + Minikube lab |
| Optional EC2-C | 2 vCPU / 4 GiB / 30 GiB | 2 vCPU / 8 GiB | SonarQube lab |

Do not put SonarQube/PostgreSQL on a minimum-size Jenkins controller and still describe the controller as isolated.

### 9.2 Production placement

- Jenkins controller in private subnet or behind authenticated HTTPS.
- Ephemeral/dedicated agents in private subnets.
- EKS worker nodes in private subnets across at least two Availability Zones.
- Public ALB in public subnets; internal ALB for administrative services.
- NAT or controlled egress for package and image downloads.
- Managed database in private/isolated subnets.
- SonarQube on a dedicated service/host with a supported PostgreSQL database.

### 9.3 Correct traffic rules

| Source | Destination | Port | Reason |
|---|---|---:|---|
| Administrator IP/VPN | Jenkins HTTPS endpoint | 443 | UI |
| GitHub webhook delivery | Jenkins HTTPS endpoint | 443 | Push/PR triggers |
| SonarQube | Jenkins HTTPS/internal endpoint | 443 | Quality Gate webhook |
| Jenkins controller | Agent | 22 | SSH launcher |
| Agent | Jenkins controller | established SSH / required remoting | Agent channel |
| Agent | SonarQube | 9000 or 443 | Scanner upload |
| Agent | GitHub/ECR/Docker Hub/package registries | 443 | CI egress |
| ALB | frontend target | service target port | Application |
| frontend Pods | backend Pods | 5000 | API |
| backend Pods | database | 27017 or managed DB TLS port | Data |
| Prometheus | backend Pods | 5000 | `/metrics` |

For SSH-launched agents, EC2-B does not “check in” to Jenkins over port 8080 as the original lab draft claimed. The controller initiates SSH.

### 9.4 AWS Console creation checkpoint

For each EC2 instance:

1. AWS Console → **EC2** → **Instances** → **Launch instances**.
2. Select Ubuntu 24.04 LTS, the approved size, private subnet where possible, encrypted gp3, IMDSv2 required, and the appropriate security group.
3. Do not place long-lived AWS keys in user data.
4. After launch, open the instance → **Security** tab and confirm only intended security groups.
5. Open **Monitoring** and confirm status checks are `2/2 passed`.
6. Record private IP, instance ID, IAM role, and EBS volume ID in the implementation record.

---

## 10. Jenkins controller setup

Run controller installation commands on EC2-A.

### 10.1 Install Java and Jenkins LTS

```bash
sudo apt update
sudo apt install -y fontconfig openjdk-21-jre wget
java -version

sudo install -d -m 0755 /etc/apt/keyrings
sudo wget -O /etc/apt/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key

echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc]" \
  https://pkg.jenkins.io/debian-stable binary/ | \
  sudo tee /etc/apt/sources.list.d/jenkins.list >/dev/null

sudo apt update
sudo apt install -y jenkins
sudo systemctl enable --now jenkins
sudo systemctl status jenkins --no-pager
```

If startup fails:

```bash
sudo journalctl -u jenkins --since=-15m --no-pager
```

### 10.2 Initial UI

Retrieve the one-time password:

```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

Access Jenkins only through the approved tunnel or HTTPS endpoint.

UI:

1. Open Jenkins.
2. Paste the initial password.
3. Select **Install suggested plugins**.
4. Create a named administrator account; do not continue using a shared `admin`.
5. Confirm the Jenkins URL is the externally reachable HTTPS URL used by GitHub and SonarQube.

Do not set `-Djenkins.install.runSetupWizard=false` unless a complete tested Jenkins Configuration as Code bootstrap creates authentication, authorization, and an administrator.

### 10.3 Required plugins

Jenkins → **Manage Jenkins** → **Plugins** → **Available plugins**:

- Pipeline;
- Pipeline: Stage View;
- Multibranch Pipeline;
- Git;
- GitHub Branch Source;
- SSH Build Agents;
- SSH Agent;
- Credentials Binding;
- SonarQube Scanner for Jenkins;
- AnsiColor;
- Timestamper;
- HTML Publisher;
- Workspace Cleanup;
- Lockable Resources;
- Email Extension, only if email is enabled.

Docker Pipeline is not required by the current Jenkinsfiles because they call the Docker CLI directly.

Restart if Jenkins requests it. Then go to **Manage Jenkins** → **Plugins** → **Installed plugins** and verify each plugin is enabled and has no dependency warning.

Blue Ocean is not required. Prefer current Pipeline/Stage View unless there is a specific supported need.

### 10.4 Controller hardening

Jenkins → **Manage Jenkins** → **Nodes** → **Built-In Node** → **Configure**:

```text
Number of executors: 0
```

Then:

- **Manage Jenkins** → **Security**:
  - disable anonymous access;
  - use project/folder or matrix authorization;
  - use SSO/OIDC and MFA in production;
  - keep CSRF protection enabled;
  - disable obsolete/unused protocols and CLI access;
- put Jenkins behind HTTPS;
- restrict who can edit Jenkinsfiles that can access trusted credentials;
- back up `/var/lib/jenkins` and test restore;
- patch Jenkins and plugins on a scheduled cadence;
- review **Manage Jenkins** → **System Log** and **About Jenkins** after upgrades.

Optional Java settings:

```bash
sudo systemctl edit jenkins
```

```ini
[Service]
Environment="JAVA_OPTS=-Xmx2g -Duser.timezone=Asia/Kathmandu"
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart jenkins
```

Verify in Jenkins → **Manage Jenkins** → **System Information**:

- Java 21+;
- expected `JENKINS_HOME`;
- expected timezone;
- no builds on the built-in node.

---

## 11. Jenkins agent setup

Run these steps on the dedicated agent, EC2-B for the lab. Use a separate agent fleet in production.

### 11.1 Base packages and user

```bash
sudo apt update
sudo apt install -y \
  ca-certificates curl fontconfig git gnupg jq openjdk-21-jre \
  unzip wget xz-utils

id jenkins >/dev/null 2>&1 || sudo useradd --create-home --shell /bin/bash jenkins
sudo install -d -m 0700 -o jenkins -g jenkins /home/jenkins/.ssh
sudo install -d -m 0755 -o jenkins -g jenkins /home/jenkins/agent
java -version
```

### 11.2 Install Node 24 LTS consistently

At this document revision, Node 24 is LTS. Confirm the current LTS patch on the official Node release page, then download the correct architecture and verify its checksum.

Example for x86-64:

```bash
NODE_VERSION=24.18.0
NODE_ARCHIVE="node-v${NODE_VERSION}-linux-x64.tar.xz"

curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCHIVE}"
curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"
grep " ${NODE_ARCHIVE}$" SHASUMS256.txt | sha256sum --check -

sudo tar -xJf "${NODE_ARCHIVE}" -C /usr/local --strip-components=1
node --version
npm --version
```

For ARM64, use the `linux-arm64` archive and matching checksum. Record the exact version in the agent image/IaC. Do not install NVM only for the SSH administrator and expect the non-interactive `jenkins` user to see it.

### 11.3 Install Docker Engine

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu \
$(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

sudo apt update
sudo apt install -y \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker jenkins
```

Log out and reconnect after group changes. Verify as the actual agent user:

```bash
sudo -iu jenkins docker version
sudo -iu jenkins docker buildx version
sudo -iu jenkins docker compose version
```

Docker socket access is root-equivalent. The agent must be dedicated, patched, monitored, and treated as privileged.

### 11.4 Install AWS CLI v2

Example for x86-64:

```bash
curl -fsSLo /tmp/awscliv2.zip \
  https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip
curl -fsSLo /tmp/awscliv2.zip.sig \
  https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip.sig

# Copy the AWS CLI public-key block from the official AWS installation page to
# /tmp/aws-cli-team.asc. Do not obtain it from a third-party tutorial.
AWS_CLI_GNUPGHOME="$(mktemp -d)"
chmod 0700 "${AWS_CLI_GNUPGHOME}"
gpg --homedir "${AWS_CLI_GNUPGHOME}" \
  --import /tmp/aws-cli-team.asc
gpg --homedir "${AWS_CLI_GNUPGHOME}" \
  --with-colons --fingerprint A6310ACC4672475C |
  awk -F: '$1 == "fpr" {print $10}' |
  grep -Fx FB5DB77FD5C118B80511ADA8A6310ACC4672475C
gpg --homedir "${AWS_CLI_GNUPGHOME}" \
  --verify /tmp/awscliv2.zip.sig /tmp/awscliv2.zip

AWS_CLI_INSTALL_DIR="$(mktemp -d)"
unzip -q /tmp/awscliv2.zip -d "${AWS_CLI_INSTALL_DIR}"
sudo "${AWS_CLI_INSTALL_DIR}/aws/install" --update
aws --version
```

Use the ARM installer on ARM hosts. A `Good signature` is insufficient unless
the key fingerprint is exactly the one independently published in the official
AWS CLI installation guide. Remove the two temporary directories after the
installation. The agent should receive AWS permissions from an EC2 instance
profile, not `aws configure`.

Verify identity:

```bash
sudo -iu jenkins aws sts get-caller-identity
```

Expected: the `jenkins-agent-role`, correct AWS account, and no user access-key identity.

### 11.5 Install kubectl only where needed

Jenkins does not need a production kubeconfig in the GitOps design. Install `kubectl` on the lab host for the human cluster operator and only on agents that have an approved non-production diagnostic use.

For a supported 1.36 cluster:

```bash
KUBECTL_VERSION="$(curl -fsSL https://dl.k8s.io/release/stable-1.36.txt)"
curl -fsSLO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
curl -fsSLO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl.sha256"
echo "$(cat kubectl.sha256)  kubectl" | sha256sum --check
sudo install -m 0755 kubectl /usr/local/bin/kubectl
kubectl version --client
```

Choose the minor supported by the actual cluster. Follow Kubernetes version-skew policy.

### 11.6 Install Helm, Trivy, yq, and the Argo CD CLI

Helm v4.2.3, x86-64 example:

```bash
HELM_VERSION=v4.2.3
HELM_ARCHIVE="helm-${HELM_VERSION}-linux-amd64.tar.gz"
curl -fsSLo "/tmp/${HELM_ARCHIVE}" \
  "https://get.helm.sh/${HELM_ARCHIVE}"
echo \
  "e9b88b4ee95b18c706839c28d3a0220e5bc470e9cd9262410c90793c45ff8b7c  /tmp/${HELM_ARCHIVE}" |
  sha256sum --check -

HELM_EXTRACT_DIR="$(mktemp -d)"
tar -xzf "/tmp/${HELM_ARCHIVE}" -C "${HELM_EXTRACT_DIR}"
sudo install -m 0755 \
  "${HELM_EXTRACT_DIR}/linux-amd64/helm" \
  /usr/local/bin/helm
rm -rf "${HELM_EXTRACT_DIR}"
helm version
```

Use the published archive and checksum for the actual architecture. Bake this
verified binary into controlled agent images and test every required chart and
plugin against Helm 4 before upgrading an existing Helm 3 estate.

Trivy v0.70.0, x86-64 example:

```bash
TRIVY_VERSION=0.70.0
TRIVY_ARCHIVE="trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz"
curl -fsSLo "/tmp/${TRIVY_ARCHIVE}" \
  "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/${TRIVY_ARCHIVE}"
curl -fsSLo "/tmp/trivy-checksums.txt" \
  "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_checksums.txt"
(
  cd /tmp
  grep " ${TRIVY_ARCHIVE}$" trivy-checksums.txt | sha256sum --check -
)
TRIVY_EXTRACT_DIR="$(mktemp -d)"
tar -xzf "/tmp/${TRIVY_ARCHIVE}" -C "${TRIVY_EXTRACT_DIR}"
sudo install -m 0755 "${TRIVY_EXTRACT_DIR}/trivy" /usr/local/bin/trivy
rm -rf "${TRIVY_EXTRACT_DIR}"
trivy --version
```

The Trivy ecosystem suffered a supply-chain incident in March 2026. Do not use
mutable action tags or unverified images/assets. In production, also verify the
release asset’s Sigstore bundle with the official identity/issuer policy and
record the result in the agent-image build evidence.

Install Mike Farah `yq` v4.53.2 and verify the release checksum:

```bash
YQ_VERSION=v4.53.2
curl -fsSLo /tmp/yq_linux_amd64 \
  "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_amd64"
curl -fsSLo /tmp/yq_checksums \
  "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/checksums"
(
  cd /tmp
  grep " yq_linux_amd64$" yq_checksums | sha256sum --check -
)
sudo install -m 0755 /tmp/yq_linux_amd64 /usr/local/bin/yq
yq --version
```

The output must identify v4. The Jenkins expressions use `yq eval` syntax and are not compatible with unrelated Python `yq` packages.

Install the Argo CD v3.4.2 CLI on only the trusted delivery agent:

```bash
ARGOCD_VERSION=v3.4.2
curl -fsSLo /tmp/argocd-linux-amd64 \
  "https://github.com/argoproj/argo-cd/releases/download/${ARGOCD_VERSION}/argocd-linux-amd64"
echo \
  "d4cb1ac8002baab8afaca2da3de597b613df8459074bc7c6d96dc95161c2a33f  /tmp/argocd-linux-amd64" |
  sha256sum --check -
sudo install -m 0755 /tmp/argocd-linux-amd64 /usr/local/bin/argocd
argocd version --client
```

Use the corresponding published binary/checksum on ARM64. Keep the CLI within
the server-supported compatibility range.

### 11.7 Configure SonarScanner as a Jenkins tool

Preferred:

1. Jenkins → **Manage Jenkins** → **Tools**.
2. Find **SonarQube Scanner installations**.
3. Click **Add SonarQube Scanner**.
4. Name: `sonar-scanner`.
5. Select a pinned supported version.
6. Save.

Then use the Jenkins `tool` directive or ensure the configured tool is added to `PATH`. If a global binary is used instead, install and checksum it on the agent and record its version.

### 11.8 Agent preflight

Run as `jenkins`:

```bash
sudo -iu jenkins bash -lc '
  set -eu
  java -version
  node --version
  npm --version
  git --version
  docker version
  trivy --version
  yq --version
  aws --version
  helm version --short
  argocd version --client
'
```

Every required command must exit `0`. The Jenkins Prepare stage should fail, not print “will be invoked later,” when a mandatory tool is missing.

---

## 12. Connect Jenkins controller to the agent

### 12.1 Generate a dedicated SSH key

On EC2-A:

```bash
sudo install -d -m 0700 -o jenkins -g jenkins \
  /var/lib/jenkins/.ssh
```

```bash
sudo -iu jenkins ssh-keygen \
  -t ed25519 \
  -f /var/lib/jenkins/.ssh/devsecops-agent \
  -C jenkins-devsecops-agent \
  -N ''

sudo -iu jenkins cat /var/lib/jenkins/.ssh/devsecops-agent.pub
```

On EC2-B, append only the displayed public key:

```bash
sudo -iu jenkins sh -c 'umask 077; touch ~/.ssh/authorized_keys'
sudo -iu jenkins editor /home/jenkins/.ssh/authorized_keys
```

Do not copy the private key to EC2-B.

### 12.2 Verify the host key

From a trusted administrative path, retrieve and independently verify EC2-B’s SSH host-key fingerprint:

```bash
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

On EC2-A, add the verified public host key to:

```text
/var/lib/jenkins/.ssh/known_hosts
```

“Non verifying verification strategy” is lab-only and should not be selected for production.

Test from EC2-A:

```bash
sudo -iu jenkins ssh \
  -i /var/lib/jenkins/.ssh/devsecops-agent \
  jenkins@<EC2_B_PRIVATE_IP> \
  'hostname; id; node --version; docker version --format "{{.Server.Version}}"'
```

### 12.3 Add the SSH credential in Jenkins

Jenkins → **Manage Jenkins** → **Credentials**:

1. Select the controller store and the intended folder/domain.
2. **Add Credentials**.
3. Kind: **SSH Username with private key**.
4. ID: `devsecops-agent-ssh`.
5. Username: `jenkins`.
6. Private key: enter the dedicated private key.
7. Save.

Use the narrowest credential scope that can launch the node.

### 12.4 Add the node

Jenkins → **Manage Jenkins** → **Nodes** → **New Node**:

```text
Node name: devsecops-agent-01
Type: Permanent Agent
Executors: 1 (start here)
Remote root: /home/jenkins/agent
Labels: devsecops-agent
Usage: Only build jobs with label expressions matching this node
Launch method: Launch agents via SSH
Host: <EC2_B_PRIVATE_IP>
Credentials: devsecops-agent-ssh
Host key strategy: Known hosts file verification
```

Save and open the node log.

Expected:

- state is **Connected**;
- remoting version is accepted;
- Java is found;
- remote filesystem is writable;
- no host-key warning;
- built-in node still has zero executors.

Create a temporary smoke Pipeline restricted to `devsecops-agent`, run the preflight commands, then delete the job.

---

## 13. GitHub setup

### 13.1 Repositories

Create:

1. `three-tier-crud-app` — source, tests, Dockerfiles, Jenkinsfiles.
2. `three-tier-gitops` — Helm chart, environment values, Argo Applications.

GitHub UI:

1. Profile/organization → **Repositories** → **New repository**.
2. Create the application repo if it does not already exist.
3. Create `three-tier-gitops` as private for non-public environments.
4. Enable secret scanning and push protection where available.
5. Do not initialize the GitOps repo with plaintext secrets.

### 13.2 Authentication model

Preferred:

- GitHub App for Jenkins repository discovery/status;
- a write-enabled SSH deploy key selected only for the GitOps repository;
- least privilege and expiration/rotation policy.

GitHub App repository permissions:

| Permission | Level | Why |
|---|---|---|
| Metadata | Read | Required repository metadata |
| Contents | Read | Checkout and Jenkinsfile discovery |
| Pull requests | Read | PR discovery for the unprivileged validation jobs |
| Checks or Commit statuses | Write | Publish the selected required check mechanism |
| Webhooks | Read/write only if approved | Only when the Jenkins integration manages hooks |

Do not grant both Checks and Commit statuses write unless the installed
integration uses both. Do not grant Administration merely to simplify webhook
creation; create the hook as a repository administrator when plugin-managed
hooks are not selected.

Fine-grained PAT fallback:

- application repo: Contents read, Metadata read, and Commit statuses or Checks
  write only when Jenkins must publish build results;
- GitOps repo: Contents read/write;
- add only the repositories required;
- set the shortest practical expiry;
- store only in Jenkins Credentials.

Never place a PAT in a command-line clone URL. GitHub explicitly recommends not passing PATs as plain command-line text.

### 13.3 Add Jenkins credentials

Jenkins → **Manage Jenkins** → **Credentials** → the project folder:

- add `github-app-read`;
- add `github-gitops-write` as **SSH Username with private key**, using the
  write-enabled deploy key whose public half is registered only on
  `three-tier-gitops`;
- add `dockerhub-creds` only if the lab uses Docker Hub;
- add no AWS static key.

After saving, Jenkins displays credential IDs, not secret values. Verify the IDs exactly match the normalized Jenkinsfiles.

### 13.4 Create multibranch jobs

Jenkins dashboard → **New Item**:

Backend:

```text
Name: crud-backend
Type: Multibranch Pipeline
Branch source: GitHub
Repository: RohanKhanal14/three-tier-crud-app
Credentials: github-app-read
Script Path: jenkins/Jenkinsfile-backend
```

Frontend:

```text
Name: crud-frontend
Type: Multibranch Pipeline
Branch source: GitHub
Repository: RohanKhanal14/three-tier-crud-app
Credentials: github-app-read
Script Path: jenkins/Jenkinsfile-frontend
```

Configure protected-branch discovery on these two delivery jobs. Do not enable
PR discovery on them and do not expose deployment credentials to PR code.

Do not let either delivery multibranch job execute a Jenkinsfile supplied by a
pull request on the privileged agent. Configure two classes of jobs:

1. `crud-backend-pr` and `crud-frontend-pr` use a controller-owned pipeline or
   trusted shared library, run on an unprivileged `pr-validation` agent, and
   check out the proposed revision only as source input.
2. `crud-backend` and `crud-frontend` discover only protected/trusted delivery
   refs and run their reviewed Jenkinsfiles on `devsecops-agent`.

In **Branch Sources** → **Behaviours**, exclude fork and origin PR heads from
the privileged delivery jobs. For the separate PR jobs, configure both origin
and approved fork discovery as policy requires, but keep **Trust nobody** for
fork-supplied pipeline code: the controller-owned pipeline checks out the PR as
data. Do not attach registry, GitOps, Argo, cloud, Sonar administration, or
production-network credentials. A “trusted fork” setting does not make
arbitrary changed application code safe on a root-equivalent Docker host.

Jenkins verification:

1. Open each multibranch item.
2. Click **Scan Multibranch Pipeline Now**.
3. Open **Scan Multibranch Pipeline Log**.
4. Confirm the expected branches are discovered and both script paths are found.
5. Confirm no branch receives a deployment merely because it contains a Jenkinsfile.

### 13.5 Webhook

Jenkins must be available over trusted HTTPS at:

```text
https://<JENKINS_HOST>/github-webhook/
```

Use plugin-managed webhooks where possible. If creating one manually:

GitHub application repo → **Settings** → **Webhooks** → **Add webhook**:

```text
Payload URL: https://<JENKINS_HOST>/github-webhook/
Content type: application/json
Events: push and pull request events required by the branch source
Active: enabled
```

Use a webhook secret only when the selected Jenkins integration is configured to verify its signature. A secret entered only in GitHub with no corresponding Jenkins verification is not a control.

Verification:

1. Push a harmless documentation commit.
2. GitHub → repo **Settings** → **Webhooks** → webhook → **Recent deliveries**.
3. Open the delivery GUID.
4. Confirm a `2xx` response and inspect response headers/body.
5. In Jenkins, confirm branch indexing/build was triggered once.
6. Redeliver from GitHub only while troubleshooting.

### 13.6 Rulesets / branch protection

GitHub repo → **Settings** → **Rules** → **Rulesets**:

For `main` and release branches:

- require pull request;
- require at least one approval;
- require Jenkins backend/frontend status checks as appropriate;
- require Sonar Quality Gate/status where integrated;
- require conversation resolution;
- block force pushes and deletion;
- restrict direct pushes;
- require signed commits if the organization supports it.

Deployment policy:

| Ref | Validate | Push image | Update development | Update staging | Production |
|---|---:|---:|---:|---:|---:|
| PR | Yes | No | No | No | No |
| `develop` | Yes | Yes | Yes | No | No |
| `release/*` | Yes | Yes | No | Yes | No |
| `main` | Yes | No | No | No | No direct mutation |
| GitOps promotion PR | Values/policy checks | No rebuild | No | Source of approved digests | Manual Argo sync after approval |

---

## 14. SonarQube setup and Quality Gate

### 14.1 Deployment choice

Lab:

- dedicated EC2-C is preferred;
- Docker Compose with a supported PostgreSQL is acceptable;
- pin both images;
- use unique secrets outside Git;
- allocate persistent volumes and backups.

Production:

- supported SonarQube edition on a dedicated service/host;
- supported managed PostgreSQL where applicable;
- HTTPS, SSO, backup, monitoring, and upgrade policy;
- size according to SonarSource requirements.

Do not install only `docker-compose-plugin` on a Jenkins controller and assume a Docker engine exists.

### 14.2 Lab host preparation

On the SonarQube host:

```bash
sudo sysctl -w vm.max_map_count=524288
echo 'vm.max_map_count=524288' | \
  sudo tee /etc/sysctl.d/99-sonarqube.conf
sudo sysctl --system
```

Create a Compose file using:

- `<PINNED_SONARQUBE_IMAGE>`;
- `<PINNED_POSTGRES_IMAGE>`;
- a non-default database password loaded from a protected environment/secret;
- persistent `data`, `extensions`, `logs`, and PostgreSQL volumes;
- health checks;
- network access from the Jenkins agent to SonarQube;
- no public `9000` exposure in production.

Verify:

```bash
docker compose up -d
docker compose ps
docker compose logs --since=10m sonarqube
curl --fail http://127.0.0.1:9000/api/system/status
```

Expected API state eventually becomes `UP`.

### 14.3 Initial SonarQube UI

1. Open SonarQube through the approved tunnel/HTTPS URL.
2. Sign in with the one-time/default credentials documented for the selected image.
3. Change the administrator password immediately.
4. **Administration** → **Security** → **Users/Groups**:
   - remove broad permissions;
   - configure SSO in production.
5. Create two projects:
   - `crud-backend`;
   - `crud-frontend`.
6. Create a narrowly scoped analysis token for Jenkins.
7. Store it in Jenkins as Secret Text ID `sonarqube-token`.

Do not email or paste the token into a Jenkinsfile.

### 14.4 Configure Jenkins

Jenkins → **Manage Jenkins** → **System** → **SonarQube servers**:

```text
Name: sonarqube-server
Server URL: https://<SONAR_HOST>/
Server authentication token: sonarqube-token
```

Save and configure the scanner under **Manage Jenkins** → **Tools** as described earlier.

### 14.5 Configure the mandatory Quality Gate webhook

SonarQube:

1. **Administration** → **Configuration** → **Webhooks**, or project **Administration** → **Webhooks**.
2. Create:

```text
Name: jenkins-quality-gate
URL: https://<JENKINS_HOST>/sonarqube-webhook/
Secret: value corresponding to sonarqube-webhook-secret
```

Jenkins:

1. **Manage Jenkins** → **System** → **SonarQube servers**.
2. Expand **Advanced**.
3. Configure the matching webhook secret credential where supported.

The trailing slash on `/sonarqube-webhook/` is required by the integration documentation.

Verification:

1. Run one analysis.
2. SonarQube → **Administration** → **Configuration** → **Webhooks**.
3. Open the latest delivery.
4. Confirm HTTP `2xx`.
5. Jenkins must leave the Quality Gate wait and show the actual gate result.

### 14.6 Quality Gate

SonarQube → **Quality Gates**:

Create or assign an agreed “new code” gate. Example policy:

- no new blocker/critical issues;
- Security Rating A on new code;
- Reliability Rating A on new code;
- reviewed Security Hotspots;
- new-code coverage at least 70%;
- duplicated lines on new code below 3%.

Tune thresholds to the team, but never silently disable the frontend gate.

### 14.7 Repository-aligned analysis

Use each service’s `sonar-project.properties` as the source of truth. Avoid repeating all properties as Jenkins CLI flags.

Backend must produce:

```text
backend/coverage/lcov.info
backend/test-report.xml          # Sonar Generic Test Execution
backend/reports/junit.xml        # Jenkins JUnit
```

Frontend must produce:

```text
frontend/coverage/lcov.info
frontend/reports/junit.xml
```

Community editions may not provide the same multibranch/PR analysis features as commercial editions. Record the installed edition and configure branch analysis accordingly; do not promise PR decoration that the edition cannot perform.

UI verification for each project:

1. SonarQube → **Projects** → `crud-backend` or `crud-frontend`.
2. **Overview**: expected commit and green/red gate.
3. **Issues**: no unreviewed blocker/critical issue.
4. **Security Hotspots**: every hotspot reviewed by an authorized person.
5. **Measures** → **Coverage**: real application files are present.
6. **Activity**: analysis corresponds to the Jenkins build commit.

---

## 15. Registry setup and artifact policy

### 15.1 Docker Hub lab option

Docker Hub UI:

1. Create repositories:
   - `<DOCKERHUB_USER>/crud-backend`;
   - `<DOCKERHUB_USER>/crud-frontend`.
2. Create a scoped access token, not an account password.
3. Jenkins → **Manage Jenkins** → **Credentials** → add username/password:
   - ID `dockerhub-creds`;
   - username is the Docker Hub user;
   - password is the access token.

Private repositories require Kubernetes `imagePullSecrets` in the lab namespace. Public lab repositories avoid that secret but expose the images.

Verification after a build:

1. Docker Hub → repository → **Tags**.
2. Confirm the unique build tag.
3. Confirm its digest.
4. Do not treat `latest` as a deployable version.

### 15.2 ECR production option

Set:

```bash
AWS_REGION=ap-south-1
AWS_ACCOUNT_ID=<12_DIGIT_ACCOUNT_ID>
```

Create immutable repositories:

```bash
aws ecr create-repository \
  --repository-name three-tier/backend \
  --image-tag-mutability IMMUTABLE \
  --image-scanning-configuration scanOnPush=true \
  --region "${AWS_REGION}"

aws ecr create-repository \
  --repository-name three-tier/frontend \
  --image-tag-mutability IMMUTABLE \
  --image-scanning-configuration scanOnPush=true \
  --region "${AWS_REGION}"
```

Do not push `latest`; a second push to immutable `latest` fails.

AWS Console verification:

1. **Elastic Container Registry** → **Private registry** → **Repositories**.
2. Open each repository.
3. **Configuration**: tag immutability enabled.
4. **Images**: after build, unique tag, digest, pushed time, and scan status.
5. Configure lifecycle rules only after reviewing which immutable artifacts must be retained for rollback/audit.

### 15.3 Jenkins agent IAM role

Create an EC2 role `jenkins-agent-role`. Grant:

- `ecr:GetAuthorizationToken` on `*`;
- layer upload, `PutImage`, `BatchGetImage`, and `DescribeImages` only for the two repositories;
- no EKS admin permissions.

Repository-scoped ECR push policy shape:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "GetEcrAuthorization",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "PushOnlyApprovedServices",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeImages",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": [
        "arn:aws:ecr:<REGION>:<ACCOUNT_ID>:repository/three-tier/backend",
        "arn:aws:ecr:<REGION>:<ACCOUNT_ID>:repository/three-tier/frontend"
      ]
    }
  ]
}
```

Replace placeholders in IaC and inspect the rendered IAM policy before apply.
The EKS node/pod pull identity separately needs
`BatchCheckLayerAvailability`, `BatchGetImage`, and
`GetDownloadUrlForLayer` on these repositories plus
`GetAuthorizationToken` on `*`; it never needs upload or `PutImage`.

AWS Console:

1. **IAM** → **Roles** → **Create role** → AWS service → EC2.
2. Attach the least-privilege custom policy.
3. **EC2** → agent instance → **Actions** → **Security** → **Modify IAM role**.
4. Select `jenkins-agent-role`.
5. On agent, run `aws sts get-caller-identity`.

EKS node roles separately need ECR pull capability. The Jenkins push role is not how cluster nodes pull images.

### 15.4 Image naming and digest

Canonical ECR repositories:

```text
<ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/three-tier/backend
<ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/three-tier/frontend
```

Unique tag:

```text
<BUILD_NUMBER>-<GIT_SHORT_SHA>
```

Resolve and validate in the trusted pipeline:

```groovy
script {
    env.IMAGE_DIGEST = sh(
        returnStdout: true,
        script: '''
          aws ecr describe-images \
            --repository-name "$ECR_REPO" \
            --image-ids "imageTag=$IMAGE_TAG" \
            --region "$AWS_REGION" \
            --query 'imageDetails[0].imageDigest' \
            --output text
        '''
    ).trim()

    if (!(env.IMAGE_DIGEST ==~ /^sha256:[0-9a-f]{64}$/)) {
        error("Invalid ECR digest returned for ${env.ECR_REPO}:${env.IMAGE_TAG}")
    }
}

sh '''
  mkdir -p reports
  jq -n \
    --arg repository "$IMAGE_FULL" \
    --arg tag "$IMAGE_TAG" \
    --arg digest "$IMAGE_DIGEST" \
    --arg revision "$GIT_COMMIT" \
    '{repository:$repository,tag:$tag,digest:$digest,revision:$revision}' \
    > reports/image-identity.json
'''
```

AWS CLI can return the text `None` with exit code `0`; the regular expression
therefore is mandatory. Archive `reports/image-identity.json`. Production
desired state must use this returned digest, not calculate it and then discard
it.

---

## 16. Corrected Jenkins pipeline contract

Keep the two existing files:

- `jenkins/Jenkinsfile-backend`
- `jenkins/Jenkinsfile-frontend`

Do not replace them with the combined Jenkinsfile from the production draft.

### 16.1 Required common changes

Both files must:

1. use `agent { label 'devsecops-agent' }`;
2. check out the exact multibranch revision;
3. compute the short SHA after checkout;
4. fail if a mandatory tool is missing;
5. publish real JUnit and coverage;
6. enable the Sonar Quality Gate;
7. archive machine-readable Trivy and ZAP reports;
8. push only from authorized non-PR branches;
9. never push ECR `latest`;
10. deploy a digest in production;
11. use safe Git credential binding;
12. wait for Argo CD to reach the expected revision and Healthy state;
13. scan the resulting staging URL;
14. perform targeted cleanup instead of global destructive pruning.

These are trusted delivery Jenkinsfiles. Untrusted PR validation uses the
separate controller-owned/shared-library pipelines in sections 6.4 and 13.4.
The delivery jobs must exclude PR discovery; a top-level privileged agent plus
`when { not { changeRequest() } }` is not a security boundary.

Common opening pattern:

```groovy
pipeline {
    agent { label 'devsecops-agent' }

    options {
        skipDefaultCheckout(true)
        timeout(time: 60, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timestamps()
        ansiColor('xterm')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT = sh(
                        script: 'git rev-parse HEAD',
                        returnStdout: true
                    ).trim()
                    env.GIT_SHORT_SHA = sh(
                        script: 'git rev-parse --short=8 HEAD',
                        returnStdout: true
                    ).trim()
                    env.GIT_SOURCE_URL = sh(
                        script: 'git config --get remote.origin.url',
                        returnStdout: true
                    ).trim()
                    env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_SHORT_SHA}"
                }
            }
        }
    }
}
```

Do not initialize an image tag from an unset `GIT_COMMIT_SHORT`.

Resolve and validate every deployment variable before source installation. A
canonical per-service contract is:

| Variable | Backend | Frontend |
|---|---|---|
| `SERVICE_DIR` | `backend` | `frontend` |
| `SERVICE_KEY` | `backend` | `frontend` |
| `SONAR_PROJECT_KEY` | `crud-backend` | `crud-frontend` |
| target JUnit path | `backend/reports/junit.xml` | `frontend/reports/junit.xml` |
| target LCOV path | `backend/coverage/lcov.info` | `frontend/coverage/lcov.info` |
| ECR repository | `three-tier/backend` | `three-tier/frontend` |
| GitOps values key | `.backend.image` | `.frontend.image` |

Resolve environment-specific values from a reviewed mapping, not from user
input:

| Source ref | Build/push | `DEPLOY_ENV` | values file | `ARGO_APP` | `DEPLOYMENT_URL` |
|---|---:|---|---|---|---|
| `develop` | Yes | `dev` | `values-dev.yaml` | `three-tier-dev` | approved dev HTTPS URL |
| `release/*` | Yes | `staging` | `values-staging.yaml` | `three-tier-staging` | approved staging HTTPS URL |
| `main` | No rebuild/deploy | — | — | — | — |

Both services also set the approved SSH `GITOPS_REPO`, `GITOPS_BRANCH=main`,
and `REGISTRY_HOST`. Production is a separate promotion pull request that moves
the already-tested staging digests into `values-prod.yaml`; it never rebuilds
source. If the team chooses different refs, change this table, section 13.6,
the Jenkins guards, and the ruleset together.

Configure Jest with `jest-junit` and Vitest with its JUnit reporter so the
listed XML files really exist. A Prepare stage must reject empty values,
`YOUR_*`, `<PLACEHOLDER>`, an unknown registry type, an invalid HTTPS staging
URL, and missing tools/files. It must also prove that `IMAGE_FULL` belongs to
the expected account/namespace and that `GITOPS_REPO` is the approved
repository. Do not allow Groovy `null` to become a tag, URL, or path.

### 16.2 Branch mutation guard

Use the same mutation guard on registry push, GitOps update, and deployment
wait:

```groovy
when {
    allOf {
        not { changeRequest() }
        anyOf {
            branch 'develop'
            expression { env.BRANCH_NAME?.startsWith('release/') }
        }
    }
}
```

The separate PR jobs never reach this Jenkinsfile. The `changeRequest()` check
is defense in depth, not the trust boundary. DAST runs only when
`DEPLOY_ENV == 'staging'`; development deployment may use a smaller smoke suite.

Pushing an image from every feature branch and moving `latest` is not an acceptable branch strategy.

### 16.3 Stage order

| Order | Backend | Frontend | Blocks? |
|---:|---|---|---:|
| 1 | Checkout + version | Checkout + version | Yes |
| 2 | Tool preflight | Tool preflight | Yes |
| 3 | `npm ci` | `npm ci` | Yes |
| 4 | Real ESLint | Real ESLint | Yes |
| 5 | Jest + LCOV + JUnit | Vitest + LCOV + JUnit | Yes |
| 6 | — | `npm run build` | Yes |
| 7 | Sonar analysis | Sonar analysis | Yes |
| 8 | Quality Gate | Quality Gate | Yes |
| 9 | Trivy filesystem/secret/config | Trivy filesystem/secret/config | Yes per policy |
| 10 | Docker build | Docker build | Yes |
| 11 | Trivy image + SBOM | Trivy image + SBOM | Yes per policy |
| 12 | Push unique tag | Push unique tag | Protected refs only |
| 13 | Resolve digest | Resolve digest | Protected refs only |
| 14 | Update only backend digest | Update only frontend digest | Protected refs only |
| 15 | Wait for expected Argo revision | Wait for expected Argo revision | Yes |
| 16 | API smoke/ZAP API scan | UI smoke/ZAP baseline | Yes per policy |
| 17 | Publish/notify/targeted cleanup | Publish/notify/targeted cleanup | Always |

The frontend needs a separate build stage so source build errors do not appear only inside Docker.

### 16.4 Test publication

Backend example:

```groovy
stage('Backend Tests') {
    steps {
        dir('backend') {
            sh '''
              mkdir -p reports
              npm run test:coverage
              test -s coverage/lcov.info
              test -s test-report.xml
              test -s reports/junit.xml
            '''
        }
    }
    post {
        always {
            junit(
                testResults: 'backend/reports/junit.xml',
                allowEmptyResults: false
            )
            archiveArtifacts(
                artifacts: 'backend/coverage/**,backend/test-report.xml',
                allowEmptyArchive: false
            )
            publishHTML(target: [
                reportDir: 'backend/coverage/lcov-report',
                reportFiles: 'index.html',
                reportName: 'Backend Coverage',
                keepAll: true,
                alwaysLinkToLastBuild: true,
                allowMissing: false
            ])
        }
    }
}
```

The frontend creates `frontend/reports/junit.xml`, asserts that file and
`frontend/coverage/lcov.info` are non-empty, then publishes the same paths with
`allowEmptyResults: false` and `allowEmptyArchive: false`; publish
`frontend/coverage/index.html` as **Frontend Coverage** with
`allowMissing: false`. Do not use an `npm test ... || npm test ...` fallback;
it can turn a real first failure into a misleading retry.

Jenkins UI after the stage:

1. Job → branch → build.
2. Open **Test Result**.
3. Confirm expected test count.
4. Open **Artifacts** or published coverage report.
5. Confirm application files, not just loaded components, appear in coverage.

### 16.5 Sonar stage

Use the properties file:

```groovy
stage('SonarQube Analysis') {
    steps {
        script {
            def scannerHome = tool 'sonar-scanner'
            dir("${SERVICE_DIR}") {
                withSonarQubeEnv('sonarqube-server') {
                    sh "${scannerHome}/bin/sonar-scanner"
                }
            }
        }
    }
}

stage('Quality Gate') {
    steps {
        timeout(time: 10, unit: 'MINUTES') {
            waitForQualityGate(
                abortPipeline: true,
                webhookSecretId: 'sonarqube-webhook-secret'
            )
        }
    }
}
```

This depends on the mandatory Sonar webhook. Frontend and backend each submit one analysis and immediately wait for its result.

### 16.6 Trivy reports and gates

Create a report, then enforce policy:

```bash
mkdir -p reports

trivy fs \
  --scanners vuln,secret,misconfig \
  --severity HIGH,CRITICAL \
  --format json \
  --output reports/trivy-fs.json \
  --exit-code 0 \
  .

trivy fs \
  --scanners vuln,secret,misconfig \
  --severity HIGH,CRITICAL \
  --format table \
  --no-progress \
  --exit-code 1 \
  .
```

Image:

```bash
trivy image \
  --scanners vuln \
  --severity HIGH,CRITICAL \
  --format json \
  --output reports/trivy-image.json \
  --exit-code 0 \
  "${IMAGE_FULL}:${IMAGE_TAG}"

trivy image \
  --scanners vuln \
  --severity HIGH,CRITICAL \
  --no-progress \
  --exit-code 1 \
  "${IMAGE_FULL}:${IMAGE_TAG}"

trivy image \
  --format cyclonedx \
  --output reports/sbom.cdx.json \
  "${IMAGE_FULL}:${IMAGE_TAG}"
```

Archive each mandatory output in the `post { always { ... } }` block of the
stage that creates it:

```groovy
post {
    always {
        archiveArtifacts(
            artifacts: 'reports/trivy-image.json,reports/sbom.cdx.json',
            allowEmptyArchive: false
        )
    }
}
```

Use the equivalent exact `trivy-fs.json` path in the filesystem-scan stage.
This fails a scan stage that forgot its report without adding a misleading
artifact failure when checkout, dependency installation, or lint failed before
Trivy ran.

An unexpected Trivy exit code is a tool failure. The original troubleshooting claim that exit code 5 means “no vulnerabilities” was incorrect.

Use `.trivyignore` only for reviewed, time-bounded exceptions containing:

- CVE/rule ID;
- owner;
- justification;
- expiry/remediation date.

### 16.7 Container build

```bash
docker build \
  --pull \
  --label "org.opencontainers.image.revision=${GIT_COMMIT}" \
  --label "org.opencontainers.image.source=${GIT_SOURCE_URL}" \
  --tag "${IMAGE_FULL}:${IMAGE_TAG}" \
  --file "${SERVICE_DIR}/Dockerfile" \
  "${SERVICE_DIR}"
```

Do not pass the frontend API origin as a build argument in the canonical same-origin design.
This form intentionally runs from the repository root. Wrapping a build in
`dir("${SERVICE_DIR}")` and using `.` is equivalent; using the repository root
as `.` without an explicit service Dockerfile/context is not.

### 16.8 Registry authentication and push

Docker Hub:

```groovy
withCredentials([usernamePassword(
    credentialsId: 'dockerhub-creds',
    usernameVariable: 'DOCKER_USER',
    passwordVariable: 'DOCKER_TOKEN'
)]) {
    script {
        def dockerConfig = "${pwd(tmp: true)}/docker-config"
        withEnv(["DOCKER_CONFIG=${dockerConfig}"]) {
            sh '''
              set -eu
              set +x
              install -d -m 0700 "$DOCKER_CONFIG"
              trap 'docker logout "$REGISTRY_HOST" >/dev/null 2>&1 || true' EXIT
              printf '%s' "$DOCKER_TOKEN" |
                docker login "$REGISTRY_HOST" \
                  --username "$DOCKER_USER" --password-stdin
              docker push "${IMAGE_FULL}:${IMAGE_TAG}"
            '''
        }
    }
}
```

ECR:

```bash
aws ecr get-login-password --region "${AWS_REGION}" |
  docker login \
    --username AWS \
    --password-stdin \
    "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

docker push "${IMAGE_FULL}:${IMAGE_TAG}"
```

Use single-quoted Jenkins shell bodies when secrets are expanded so Groovy does not interpolate them into process arguments.
Use the same per-build `DOCKER_CONFIG` and exact-host logout for ECR. A bare
`docker logout` defaults to Docker Hub and can leave ECR credentials in a
shared agent configuration. Workspace cleanup must remove the temporary
configuration.

### 16.9 Safe GitOps update

Preferred production model: Jenkins creates a GitOps pull request that promotes an already tested digest.

For direct lab/staging updates, use Jenkins’ Git credential binding rather than
a token in the URL. The cross-job lock is mandatory because backend and
frontend are different jobs:

```groovy
def updateGitOps = {
    sshagent(credentials: ['github-gitops-write']) {
        sh '''
          set -eu
          test ! -e gitops-repo
          git clone "$GITOPS_REPO" gitops-repo
          cd gitops-repo
          git checkout "$GITOPS_BRANCH"

          yq eval \
            ".${SERVICE_KEY}.image.repository = strenv(IMAGE_FULL)" \
            -i "$HELM_VALUES_FILE"
          yq eval \
            ".${SERVICE_KEY}.image.digest = strenv(IMAGE_DIGEST)" \
            -i "$HELM_VALUES_FILE"

          git config user.email "jenkins@ci.local"
          git config user.name "Jenkins CI"
          git add "$HELM_VALUES_FILE"

          if ! git diff --cached --quiet; then
            git commit -m \
              "ci(${SERVICE_KEY}): deploy ${IMAGE_DIGEST} from build ${BUILD_NUMBER}"
            git pull --rebase origin "$GITOPS_BRANCH"
            git push origin "HEAD:${GITOPS_BRANCH}"
          fi

          git rev-parse HEAD > ../gitops-revision.txt
        '''
        script {
            env.GITOPS_REVISION = readFile('gitops-revision.txt').trim()
        }
    }
}
```

The frontend job changes only `.frontend.image.*`; the backend job changes only
`.backend.image.*`. Install the Lockable Resources plugin and use the identical
resource name in both jobs. An alternative is separate component value files
plus a reviewed merge queue.

Call that closure only inside one environment lock that wraps the entire
deployment transaction:

```groovy
lock(resource: "gitops-${env.DEPLOY_ENV}") {
    updateGitOps()
    waitForExactArgoRevisionAndLiveDigest()
    runSmokeTests()
    if (env.DEPLOY_ENV == 'staging') {
        runZapAndPublishEvidence()
    }
}
```

Those helper closures contain the exact commands in sections 16.10 and 26.
Do not lock only `git push`: the other service could push a newer commit before
Argo observes the first SHA, causing the first job to time out or scan a moving
target. A single queued promotion job is also valid. Release the lock only
after evidence is archived.

Use an SSH-form GitOps URL such as
`git@github.com:<ORG>/three-tier-gitops.git`. Populate the Jenkins agent user’s
`known_hosts` from a host key whose fingerprint was independently compared with
GitHub’s published SSH fingerprints. Never set
`StrictHostKeyChecking=no`.

Notes:

- `git commit || echo "No changes"` is prohibited because it hides real commit failures.
- `disableConcurrentBuilds()` does not prevent a race between two different
  jobs; the shared lock does.
- Always remove the workspace in `post` after credential use.

### 16.10 Wait for the deployed revision

A stage that only prints “Argo CD will sync” is not a wait.

Use a scoped Argo token that can read Application status and manifests but
cannot sync or administer the cluster. The GitOps stage must record the full
pushed commit in `GITOPS_REVISION`; do not use the application-source SHA:

```bash
set -eu

test -n "${GITOPS_REVISION}"
test -n "${IMAGE_DIGEST}"

DEADLINE=$((SECONDS + 600))
while :; do
  CURRENT_REVISION="$(
    argocd app get "${ARGO_APP}" -o json |
      jq -r '.status.sync.revision // empty'
  )"
  if [ "${CURRENT_REVISION}" = "${GITOPS_REVISION}" ]; then
    break
  fi
  if [ "${SECONDS}" -ge "${DEADLINE}" ]; then
    echo "Argo did not observe ${GITOPS_REVISION}" >&2
    exit 1
  fi
  sleep 5
done

argocd app wait "${ARGO_APP}" --sync --health --timeout 600

argocd app get "${ARGO_APP}" -o json > reports/argocd-status.json
test "$(
  jq -r '.status.sync.revision' reports/argocd-status.json
)" = "${GITOPS_REVISION}"
test "$(
  jq -r '.status.sync.status' reports/argocd-status.json
)" = "Synced"
test "$(
  jq -r '.status.health.status' reports/argocd-status.json
)" = "Healthy"

argocd app manifests "${ARGO_APP}" \
  --source live \
  > reports/argocd-live-manifests.yaml
grep -F -- "${IMAGE_FULL}@${IMAGE_DIGEST}" \
  reports/argocd-live-manifests.yaml
```

`argocd app wait --sync --health` alone can succeed against the previously
healthy revision; it has no revision option. The loop first proves Argo
observed the expected GitOps commit, the post-wait assertions catch a later
transition, and the live-manifest check proves the expected digest reached the
Deployment. Do not configure `ignoreDifferences` for container image fields;
that could make Argo appear synced while the live image differs. If
the Argo endpoint uses a private CA, install that CA in the agent trust store;
do not use `--insecure`. Configure `--grpc-web` only when the reviewed ingress
path requires it. The agent needs no Kubernetes administrator kubeconfig.

Only after this passes may the ZAP stage start.

### 16.11 Post actions

Use one `post` block per Jenkinsfile:

```groovy
post {
    always {
        script {
            if (fileExists('reports/zap')) {
                archiveArtifacts(
                    artifacts: 'reports/zap/**',
                    allowEmptyArchive: false
                )
            }
            if (fileExists('reports/argocd-status.json')) {
                archiveArtifacts(
                    artifacts: 'reports/argocd-status.json,reports/argocd-live-manifests.yaml,reports/image-identity.json',
                    allowEmptyArchive: false
                )
            }
        }
        sh '''
          docker image rm "${IMAGE_FULL}:${IMAGE_TAG}" 2>/dev/null || true
        '''
        cleanWs(deleteDirs: true)
    }
    success {
        echo "[${SERVICE_KEY}] build ${BUILD_NUMBER} passed"
    }
    failure {
        echo "[${SERVICE_KEY}] build ${BUILD_NUMBER} failed"
    }
}
```

Do not run broad `docker system prune -af` on a shared agent. Start disk diagnosis with:

```bash
docker system df -v
df -h
```

### 16.12 Jenkins UI inspection

For every build:

1. Dashboard → service job → branch → build number.
2. **Stage View**: identify the first red stage.
3. **Console Output**: inspect the exact command and tool version.
4. **Changes**: confirm intended commit.
5. **Test Result**: confirm tests and failures.
6. **Artifacts**: open Trivy JSON, SBOM, coverage, and ZAP reports.
7. Follow the SonarQube project link and confirm the same commit.
8. For a deployment build, follow the GitOps commit and confirm only one service digest changed.
9. Never use **Replay** to deploy unreviewed pipeline code with production credentials.

---

## 17. GitOps repository and Helm chart

### 17.1 Target tree

```text
three-tier-gitops/
├── charts/
│   └── three-tier-app/
│       ├── Chart.yaml
│       ├── values.yaml
│       ├── values.schema.json
│       ├── values-lab.yaml
│       ├── values-dev.yaml
│       ├── values-staging.yaml
│       ├── values-prod.yaml
│       └── templates/
│           ├── _helpers.tpl
│           ├── serviceaccounts.yaml
│           ├── configmaps.yaml
│           ├── frontend-deployment.yaml
│           ├── frontend-service.yaml
│           ├── backend-deployment.yaml
│           ├── backend-service.yaml
│           ├── mongodb-lab-configmap.yaml
│           ├── mongodb-lab-statefulset.yaml
│           ├── mongodb-lab-service.yaml
│           ├── gateway.yaml
│           ├── httproute.yaml
│           ├── ingress-alb.yaml
│           ├── secretstore.yaml
│           ├── externalsecret.yaml
│           ├── hpa-frontend.yaml
│           ├── hpa-backend.yaml
│           ├── pdb-frontend.yaml
│           ├── pdb-backend.yaml
│           ├── networkpolicies.yaml
│           ├── servicemonitor.yaml
│           └── prometheusrule.yaml
├── argocd/
│   ├── project.yaml
│   ├── app-lab.yaml
│   ├── app-dev.yaml
│   ├── app-staging.yaml
│   └── app-prod.yaml
└── platform/
    ├── argocd/values.yaml
    ├── external-secrets/values.yaml
    ├── monitoring/values.yaml
    ├── loki/values-lab.yaml
    ├── loki/values-prod.yaml
    └── alloy/values.yaml
```

Do not add a plaintext `secrets.yaml`.

### 17.2 Chart metadata

```yaml
apiVersion: v2
name: three-tier-app
description: React, Nginx, Express, and Mongo-compatible three-tier CRUD app
type: application
version: 0.1.0
appVersion: "1.0.0"
```

Increment chart `version` when template behavior changes. Image promotion does not require changing `appVersion`.

### 17.3 Base values

```yaml
global:
  environment: ""
  imagePullPolicy: IfNotPresent

frontend:
  replicas: 2
  image:
    repository: ""
    tag: ""
    digest: ""
  service:
    port: 8080
    targetPort: 8080
  resources:
    requests: { cpu: 100m, memory: 128Mi }
    limits: { cpu: 500m, memory: 512Mi }
  autoscaling:
    enabled: false
    minReplicas: 2
    maxReplicas: 6
    targetCPUUtilizationPercentage: 60

backend:
  replicas: 2
  image:
    repository: ""
    tag: ""
    digest: ""
  service:
    port: 5000
    targetPort: 5000
  resources:
    requests: { cpu: 200m, memory: 256Mi }
    limits: { cpu: "1", memory: 1Gi }
  autoscaling:
    enabled: false
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 60

gatewayApi:
  enabled: false
  gatewayClassName: ""
  host: ""

ingress:
  enabled: false
  className: ""
  host: ""
  tls: false

monitoring:
  serviceMonitor:
    enabled: false
    releaseLabel: kube-prometheus-stack

externalSecrets:
  enabled: false

mongodbLab:
  enabled: false
```

The base file is intentionally environment-neutral and exposes nothing.
Environment files must set a non-empty environment, image repositories and
digests, and exactly one north-south mechanism:

- lab: `gatewayApi.enabled: true` with the installed maintained GatewayClass;
- EKS: `ingress.enabled: true`, class `alb`, and reviewed ALB annotations.

Production also overrides DNS, TLS/ACM details, replica/HPA policy, resources,
and External Secrets. Enable `ServiceMonitor` and `PrometheusRule` only after
their CRDs and monitoring selectors exist. Enforce these invariants with
`values.schema.json` and render tests so a missing override cannot deploy a
staging identity or public endpoint accidentally. Only `values-lab.yaml` may
set `mongodbLab.enabled: true`; schema/render policy must reject it for every
other environment.

### 17.4 Digest-aware template

Define one helper in `_helpers.tpl`:

```gotemplate
{{- define "three-tier.image" -}}
{{- if .digest -}}
{{ printf "%s@%s" .repository .digest }}
{{- else -}}
{{ printf "%s:%s" .repository .tag }}
{{- end -}}
{{- end -}}
```

Use the helper as a quoted scalar:

```gotemplate
image: {{ include "three-tier.image" .Values.backend.image | quote }}
```

Use `.Values.frontend.image` for the frontend. Production values require
`digest`; tag fallback is for controlled lab use. Do not put whitespace-chomping
template directives directly after a YAML folded-scalar marker; they can remove
the required newline and produce invalid output. Prove the exact image strings
with `helm template`.

### 17.5 Validation before Argo CD

From the GitOps repo:

```bash
helm dependency build charts/three-tier-app
helm lint charts/three-tier-app \
  -f charts/three-tier-app/values-staging.yaml

helm template three-tier-staging charts/three-tier-app \
  --namespace three-tier-staging \
  -f charts/three-tier-app/values-staging.yaml \
  > /tmp/three-tier-rendered.yaml

kubectl apply \
  --dry-run=server \
  --namespace three-tier-staging \
  -f /tmp/three-tier-rendered.yaml

trivy config \
  --severity HIGH,CRITICAL \
  --exit-code 1 \
  /tmp/three-tier-rendered.yaml
```

Commit `Chart.lock` and review dependency version/digest changes separately.
`helm dependency update` resolves newer matching dependencies and therefore
does not belong in a release validation job. Repeat lint/render/policy checks
for `values-lab.yaml`, `values-dev.yaml`, `values-staging.yaml`, and
`values-prod.yaml`; run server dry-run against a cluster that has each profile’s
required CRDs.

`--dry-run=server` requires access to the intended validation cluster and catches schema/admission issues that client parsing cannot.

GitHub UI review:

1. Open the GitOps pull request.
2. Confirm rendered-manifest checks pass.
3. Confirm no Secret values appear.
4. Confirm only the intended environment/service digest changed.
5. Require platform-owner review for production.

---

## 18. Kubernetes workload requirements

### 18.1 Namespaces and labels

Namespaces are created by Argo CD, not by the application chart. Every
Application uses `CreateNamespace=true` plus `managedNamespaceMetadata`; this
provides labels atomically and avoids an absent `templates/namespace.yaml`.
The rendered namespace contract is:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: three-tier-staging
  labels:
    environment: staging
```

Every resource should use standard labels:

```yaml
app.kubernetes.io/name
app.kubernetes.io/instance
app.kubernetes.io/component
app.kubernetes.io/part-of
app.kubernetes.io/version
```

### 18.2 Service accounts

The drafts referenced a backend ServiceAccount without defining it. Create frontend and backend ServiceAccounts and disable token mounting when Kubernetes API access is unnecessary:

```yaml
automountServiceAccountToken: false
```

Do not bind application ServiceAccounts to cluster-admin.

### 18.3 Numeric non-root identity

Kubernetes cannot reliably enforce `runAsNonRoot` when an image declares only a non-numeric username. Build images with explicit numeric IDs and verify:

```bash
docker run --rm --entrypoint id <IMAGE>:<TAG>
```

Target:

- backend image: explicit UID/GID such as `10001`;
- frontend image: verified numeric Nginx UID, consistently used in Dockerfile and Pod.

Pod-level:

```yaml
securityContext:
  runAsNonRoot: true
  seccompProfile:
    type: RuntimeDefault
```

Container-level:

```yaml
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
```

For Nginx read-only root filesystem, mount writable `emptyDir` volumes for its PID/cache/temp paths. Keep static assets root-owned and read-only.

### 18.4 Probes

Frontend:

```yaml
readinessProbe:
  httpGet: { path: /healthz, port: http }
livenessProbe:
  httpGet: { path: /healthz, port: http }
```

Backend now has only DB-dependent `/health`. Until a process-only `/live` endpoint is added:

```yaml
readinessProbe:
  httpGet: { path: /health, port: http }
livenessProbe:
  tcpSocket: { port: http }
```

This removes unready Pods during DB outage without restarting a healthy Node process repeatedly.

### 18.5 Named ports and Services

Backend container:

```yaml
ports:
  - name: http
    containerPort: 5000
```

Backend Service:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-svc
  labels:
    app.kubernetes.io/name: backend
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: backend
  ports:
    - name: http
      port: 5000
      targetPort: http
```

Frontend Service uses named `http`, port `8080`, target `8080`, type
ClusterIP. Matching Service and container ports is required when production
uses Amazon VPC CNI native NetworkPolicy.

### 18.6 North-south routing: Gateway API and ALB

Ingress NGINX was retired on 2026-03-24 and no longer receives security fixes.
Do not create a new installation. The current raw
`k8s/network/ingress.yaml` is migration input, not the target.

The lab uses Gateway API with a pinned maintained implementation. The
platform-owned `GatewayClass` must already exist. The application chart creates
the namespaced Gateway and HTTPRoute:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: crud-gateway
  namespace: three-tier-lab
spec:
  gatewayClassName: eg
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      hostname: lab.crud.local
      allowedRoutes:
        namespaces:
          from: Same
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: three-tier-app
  namespace: three-tier-lab
spec:
  parentRefs:
    - name: crud-gateway
      sectionName: http
  hostnames:
    - lab.crud.local
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: frontend-svc
          port: 8080
```

The chart templates namespace and host from values; the literal lab names above
show the rendered contract. No regex or rewrite is required. Nginx preserves
`/api` and proxies it internally.

EKS uses a separate conditional `Ingress` template with
`ingressClassName: alb`, target type `ip`, HTTP and HTTPS listeners, ACM
certificate, SSL redirect, `/healthz`, and the correct scheme. AWS Load
Balancer Controller must be installed and healthy first.

Both profiles route every public application path to `frontend-svc`. Do not
publish the backend, database, or `/metrics`.

### 18.7 HPA and replicas

HPA needs:

- metrics-server/metrics pipeline;
- CPU requests;
- a workload that can safely run multiple replicas;
- load testing.

When HPA is enabled, avoid continuously forcing a fixed `spec.replicas` from Helm. Template replicas conditionally or let HPA own the field.

### 18.8 PodDisruptionBudget

Use a PDB only when the component has at least two healthy replicas. `minAvailable: 1` on a one-replica lab workload can block voluntary maintenance.

### 18.9 NetworkPolicy model

Required flows:

| Source | Destination | Port |
|---|---|---:|
| Gateway/ALB data path | frontend | 8080 |
| frontend | backend | 5000 |
| monitoring namespace | backend | 5000 |
| backend | MongoDB lab | 27017 |
| application Pods | kube-dns | 53 TCP/UDP |

Standard NetworkPolicy cannot select an external ALB by namespace label. In EKS, combine:

- ClusterIP Services;
- AWS security groups / security groups for Pods where selected;
- VPC/subnet restrictions;
- CNI-enforced NetworkPolicy for Pod-to-Pod flows.

In the Calico lab, test policies with short-lived diagnostic Pods carrying the
intended source labels. With Amazon VPC CNI native NetworkPolicy, standalone
Pods are not consistently covered; use a one-replica temporary Deployment so
the test Pod has a Deployment/ReplicaSet owner reference. Also keep each
Service port equal to its container port and use the same named port. Do not
`exec curl` into the Nginx image; it may not contain curl.

### 18.10 MongoDB lab

The lab StatefulSet requires:

- `serviceName: mongodb-svc`;
- headless `mongodb-svc` with `clusterIP: None`;
- persistent storage;
- resource requests/limits;
- readiness/liveness using `mongosh ping`;
- a `mongodb-bootstrap` Secret containing root bootstrap and separate
  least-privilege application-user inputs;
- `mongod --auth`;
- a first-start `/docker-entrypoint-initdb.d` script that creates only the
  application user with `readWrite` on the application database;
- backend `MONGO_URI` from `backend-secrets`, using the application user and
  its `authSource`, never the root user;
- a backup/restore exercise.

The initialization script runs only when the data volume is empty. Changing the
ConfigMap or bootstrap Secret later does not rotate an existing database user;
use an authenticated rotation procedure and test it. Never put the URI back in
`backend-config`.

Production must not inherit this single-node design.

---

## 19. Minikube lab track

This track is for a controlled teaching environment. The Jenkins agent, Docker
daemon, Minikube cluster, lab database, Argo CD, and observability components may
share one host only when:

- the host contains no production credentials or data;
- pull requests from forks cannot run on it;
- Docker and Kubernetes access are treated as host-root-equivalent;
- the host can be destroyed and rebuilt;
- administrative UIs are reachable only through localhost and an authenticated
  SSH tunnel.

### 19.1 Preflight the host

Install the reviewed Minikube release if it is absent. This x86-64 example pins
v1.38.1 and verifies the checksum published with that release:

```bash
MINIKUBE_VERSION=v1.38.1
curl -fsSLo /tmp/minikube-linux-amd64 \
  "https://github.com/kubernetes/minikube/releases/download/${MINIKUBE_VERSION}/minikube-linux-amd64"
echo \
  "099477eaf248bcb5bcea8ce78a2898e93ac01461c35189da1848c3de82ecd22e  /tmp/minikube-linux-amd64" |
  sha256sum --check -
sudo install -m 0755 /tmp/minikube-linux-amd64 /usr/local/bin/minikube
```

Use the matching published binary/checksum on ARM64. Re-review the pin before a
new installation.

Run as the designated Minikube operator, not with `sudo`:

```bash
docker version
kubectl version --client
minikube version
helm version

free -h
df -h
docker system df
```

Use a supported Kubernetes patch and record it in the implementation record:

```bash
export LAB_PROFILE=crud-lab
export LAB_K8S_VERSION=v1.35.1

minikube start \
  --profile "${LAB_PROFILE}" \
  --driver docker \
  --kubernetes-version "${LAB_K8S_VERSION}" \
  --cpus 4 \
  --memory 12288 \
  --disk-size 80g \
  --cni calico
```

Do not silently fall back to an unsupported version. If Minikube rejects the
selected version, choose a patch supported by both the installed Minikube
release and the version policy in section 7.

Confirm the context before every cluster command:

```bash
minikube status --profile "${LAB_PROFILE}"
kubectl config current-context
kubectl cluster-info
kubectl get nodes -o wide
kubectl get --raw=/readyz
```

Expected:

- context is `crud-lab`;
- the node is `Ready`;
- the API readiness endpoint returns `ok`.

### 19.2 Enable the lab add-ons

```bash
minikube addons enable metrics-server --profile "${LAB_PROFILE}"
minikube addons enable storage-provisioner --profile "${LAB_PROFILE}"

kubectl -n kube-system rollout status \
  deployment/metrics-server \
  --timeout=180s

kubectl get storageclass
kubectl top nodes
```

Do not enable Minikube’s `ingress` add-on: it installs the retired
Ingress NGINX controller.

Install the reviewed Envoy Gateway example. The chart installs the compatible
Gateway API and Envoy Gateway CRDs; if platform IaC already owns those CRDs,
confirm compatibility and disable chart CRD ownership instead:

```bash
helm upgrade --install eg \
  oci://docker.io/envoyproxy/gateway-helm \
  --version v1.8.3 \
  --namespace envoy-gateway-system \
  --create-namespace \
  --wait \
  --timeout 10m

kubectl -n envoy-gateway-system wait \
  --for=condition=Available \
  deployment/envoy-gateway \
  --timeout=300s
```

Create the platform-owned class:

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: eg
spec:
  controllerName: gateway.envoyproxy.io/gatewayclass-controller
```

Store that manifest in the platform GitOps path, apply it once, and verify:

```bash
kubectl get crd gateways.gateway.networking.k8s.io
kubectl get crd httproutes.gateway.networking.k8s.io
kubectl get gatewayclass eg
kubectl -n envoy-gateway-system get pods
```

If `kubectl top nodes` initially returns “Metrics API not available,” inspect:

```bash
kubectl -n kube-system logs deployment/metrics-server --tail=100
kubectl get apiservice v1beta1.metrics.k8s.io
```

Calico is deliberate: the default Minikube networking choice may not enforce
NetworkPolicy. Verify the installed CNI before describing any policy test as
successful.

### 19.3 Create namespaces

```bash
kubectl create namespace three-tier-lab \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl label namespace three-tier-lab \
  environment=lab \
  app.kubernetes.io/part-of=three-tier-crud \
  --overwrite
```

Argo CD, monitoring, and logging use their own namespaces:

```text
argocd
envoy-gateway-system
monitoring
loki
alloy
```

Do not put all platform components in the application namespace merely to make
NetworkPolicy selectors easier.

### 19.4 Configure private registry access, if needed

Public images do not require an image pull Secret. For a private registry, log
in without writing the token into a Kubernetes manifest or shell history:

```bash
export LAB_REGISTRY_SERVER=<REGISTRY_HOST>
export LAB_REGISTRY_USER=<REGISTRY_USER>
export DOCKER_CONFIG="$(mktemp -d)"
trap 'rm -rf "${DOCKER_CONFIG}"' EXIT

read -rsp "Registry token: " LAB_REGISTRY_TOKEN
printf '\n'
printf '%s' "${LAB_REGISTRY_TOKEN}" |
  docker login "${LAB_REGISTRY_SERVER}" \
    --username "${LAB_REGISTRY_USER}" \
    --password-stdin
unset LAB_REGISTRY_TOKEN

kubectl -n three-tier-lab create secret generic registry-pull \
  --from-file=.dockerconfigjson="${DOCKER_CONFIG}/config.json" \
  --type=kubernetes.io/dockerconfigjson \
  --dry-run=client -o yaml |
  kubectl apply -f -
```

Reference `registry-pull` through `imagePullSecrets` in the application
ServiceAccounts. Never commit the rendered Secret.

### 19.5 Choose exactly one lab deployment owner

Use one of these paths:

| Path | Appropriate use | Owner |
|---|---|---|
| Corrected raw `k8s/` YAML | Learn Kubernetes resource ordering | `kubectl`/operator |
| GitOps Helm chart | Exercise the real delivery flow | Argo CD |

Do not apply both to `three-tier-lab`.

#### Raw-manifest path

The current raw resources are not ready until every correction in sections 4
and 8.8 has been made. After correction:

```bash
kubectl apply --dry-run=server -n three-tier-lab \
  -f k8s/db/db-svc.yaml
kubectl apply --dry-run=server -n three-tier-lab \
  -f k8s/db/db-deployment.yaml
kubectl apply --dry-run=server -n three-tier-lab \
  -f k8s/backend/
kubectl apply --dry-run=server -n three-tier-lab \
  -f k8s/frontend/
kubectl apply --dry-run=server -n three-tier-lab \
  -f k8s/network/
```

Only after all dry runs pass:

```bash
./k8s/apply-all.sh three-tier-lab
```

The corrected script must:

1. resolve its own directory;
2. create or verify the namespace;
3. apply the database Service before the StatefulSet;
4. wait for PVC binding;
5. wait for database, backend, and frontend readiness;
6. apply Gateway/HTTPRoute and NetworkPolicies;
7. print resource status without printing Secrets.

#### Argo-managed path

Complete sections 17, 21, and 22. Point a lab Argo Application at
`values-lab.yaml`, use namespace `three-tier-lab`, and set
`mongodbLab.enabled: true`. Create the non-Git lab database Secrets first.
The conditional lab MongoDB Service/StatefulSet/init ConfigMap are then owned by
the chart. Raw resources must not already exist under another owner.

### 19.6 Verify the lab workload

```bash
kubectl -n three-tier-lab get all
kubectl -n three-tier-lab get gateway,httproute,networkpolicy,pvc
kubectl -n three-tier-lab get events \
  --sort-by=.metadata.creationTimestamp

kubectl -n three-tier-lab rollout status \
  statefulset/mongodb --timeout=300s
kubectl -n three-tier-lab rollout status \
  deployment/backend --timeout=300s
kubectl -n three-tier-lab rollout status \
  deployment/frontend --timeout=300s

kubectl -n three-tier-lab get endpointslices

kubectl -n three-tier-lab wait \
  --for=condition=Programmed \
  gateway/crud-gateway \
  --timeout=180s

ROUTE_DEADLINE=$((SECONDS + 180))
while :; do
  ROUTE_JSON="$(
    kubectl -n three-tier-lab get \
      httproute/three-tier-app -o json
  )"
  ACCEPTED="$(
    printf '%s' "${ROUTE_JSON}" |
      jq -r '
        [.status.parents[]
         | select(.parentRef.name == "crud-gateway")
         | .conditions[]
         | select(.type == "Accepted")
         | .status][0] // ""'
  )"
  RESOLVED_REFS="$(
    printf '%s' "${ROUTE_JSON}" |
      jq -r '
        [.status.parents[]
         | select(.parentRef.name == "crud-gateway")
         | .conditions[]
         | select(.type == "ResolvedRefs")
         | .status][0] // ""'
  )"
  if [ "${ACCEPTED}" = True ] &&
     [ "${RESOLVED_REFS}" = True ]; then
    break
  fi
  if [ "${SECONDS}" -ge "${ROUTE_DEADLINE}" ]; then
    printf '%s\n' "${ROUTE_JSON}" | jq '.status.parents'
    exit 1
  fi
  sleep 3
done
```

HTTPRoute conditions live under `status.parents[].conditions`, not the generic
top-level condition path used by `kubectl wait --for=condition=Accepted`.
`Accepted=True` alone is also insufficient: `ResolvedRefs=True` proves the
referenced frontend Service/port resolved.

Use the actual workload names produced by the chosen raw YAML or chart.

For a failing Pod:

```bash
kubectl -n three-tier-lab describe pod <POD_NAME>
kubectl -n three-tier-lab logs <POD_NAME> --all-containers --tail=200
kubectl -n three-tier-lab logs <POD_NAME> \
  --all-containers --previous --tail=200
```

Expected:

- no `ImagePullBackOff`, `CrashLoopBackOff`, or failed mounts;
- all expected endpoints exist;
- readiness is `1/1`;
- backend logs are one JSON object per line;
- frontend logs go to stdout/stderr.

### 19.7 Access the application safely

The most reliable remote-lab method is a localhost-only port-forward plus an SSH
tunnel.

On the Minikube host:

```bash
kubectl -n three-tier-lab port-forward \
  --address 127.0.0.1 \
  service/frontend-svc \
  3000:8080
```

On the administrator workstation:

```bash
ssh -N \
  -L 3000:127.0.0.1:3000 \
  <SSH_USER>@<LAB_HOST>
```

Open `http://127.0.0.1:3000`.

Check:

```bash
curl --fail http://127.0.0.1:3000/healthz
curl --fail http://127.0.0.1:3000/api/items
```

Create, edit, filter, and delete one disposable item. Then inspect:

```bash
kubectl -n three-tier-lab logs \
  -l app.kubernetes.io/name=frontend \
  --since=5m --prefix

kubectl -n three-tier-lab logs \
  -l app.kubernetes.io/name=backend \
  --since=5m --prefix
```

Do not depend on a remote route to `minikube ip` with the Docker driver. It is
host/network dependent. Do not expose the entire NodePort range in the EC2
security group.

### 19.8 Test Gateway API without public exposure

Find the Envoy data-plane Service created for `crud-gateway`:

```bash
kubectl get service --all-namespaces \
  -l gateway.envoyproxy.io/owning-gateway-name=crud-gateway
```

Record the namespace/name from the result. If the pinned release uses a
different ownership label, inspect the Gateway status and Services created by
the controller; do not guess.

On the lab host:

```bash
kubectl -n <ENVOY_SERVICE_NAMESPACE> port-forward \
  --address 127.0.0.1 \
  service/<ENVOY_DATA_PLANE_SERVICE> \
  8080:80
```

From another shell on the lab host:

```bash
curl --fail \
  -H 'Host: lab.crud.local' \
  http://127.0.0.1:8080/healthz

curl --fail \
  -H 'Host: lab.crud.local' \
  http://127.0.0.1:8080/api/items
```

An API success through this route proves the intended sequence:

```text
Gateway/HTTPRoute → frontend Nginx → backend Service → backend Pod
```

### 19.9 Test NetworkPolicy

NetworkPolicy testing must prove both allowed and denied traffic.

Create short-lived diagnostic Pods with the same labels as the intended source:

```bash
kubectl -n three-tier-lab run frontend-policy-test \
  --image=curlimages/curl:<PINNED_TAG> \
  --labels=app.kubernetes.io/name=frontend \
  --restart=Never \
  --command -- sleep 600

kubectl -n three-tier-lab exec frontend-policy-test -- \
  curl --fail --max-time 5 http://backend-svc:5000/health
```

Create an unlabeled Pod and confirm access to the backend is denied. Delete both
test Pods afterward. Also verify:

- only the Envoy Gateway data-plane Pods selected by their verified namespace
  and stable labels can reach frontend port `8080`; do not allow the entire
  namespace without a pod selector;
- Prometheus can scrape backend `/metrics`;
- backend can resolve DNS and reach MongoDB;
- frontend cannot reach MongoDB;
- application Pods cannot reach Kubernetes API unless explicitly allowed.

Record the CNI and test results. A YAML file alone does not prove enforcement.

### 19.10 Lab UI checkpoints

| UI | Safe access | What to inspect |
|---|---|---|
| Application | localhost tunnel to frontend Service | CRUD lifecycle and browser Network tab |
| Argo CD | localhost tunnel from section 21 | `Synced`, `Healthy`, resource tree, image digest |
| Grafana | localhost tunnel from sections 23.8 and 24 | metrics dashboards, Explore logs, alerts |
| Prometheus | localhost tunnel from section 23.3 | Targets, rules, metric query |
| Jenkins | authenticated HTTPS | branch build, stages, tests, reports |

The Kubernetes Dashboard is optional. If installed, bind its proxy to localhost,
use a least-privilege account, and do not create a permanent cluster-admin token
for convenience.

---

## 20. Amazon EKS production track

Production platform creation should be committed Infrastructure as Code
(Terraform, OpenTofu, AWS CDK, or CloudFormation). Console paths below are
verification paths, not a substitute for reviewed IaC.

### 20.1 Record the production inputs

Before creation, approve and record:

```text
AWS account ID
AWS region
environment name
VPC CIDR
public/private/isolated subnet CIDRs
Availability Zones
EKS version
node architecture and instance families
DNS zone and application FQDN
ACM certificate ARN
ECR repositories
S3 Loki bucket names
managed database choice and endpoint
backup, retention, RPO, and RTO
cost owner and mandatory tags
```

Start every operator session with:

```bash
aws sts get-caller-identity
aws configure get region
kubectl config current-context
```

Stop if any value is unexpected.

### 20.2 VPC design

Target:

- at least two Availability Zones;
- public subnets only for internet-facing load balancers and NAT gateways;
- private subnets for EKS nodes and CI agents;
- isolated/private database subnets;
- VPC endpoints where justified for ECR API, ECR DKR, S3, CloudWatch,
  Secrets Manager, and STS;
- flow logs to a protected log destination;
- explicit egress design and cost review for NAT gateways.

Required subnet discovery tags depend on the chosen load-balancer-controller
configuration. Validate them against the installed controller version.

AWS Console verification:

1. **VPC** → **Your VPCs** → select the production VPC.
2. Check CIDR, DNS resolution, DNS hostnames, flow logs, and tags.
3. **Subnets** → group by Availability Zone and route table.
4. Confirm private node subnets do not route directly through an Internet
   Gateway.
5. **NAT gateways** → confirm only intended gateways and Elastic IPs.
6. **Network ACLs** and **Security groups** → confirm no accidental
   `0.0.0.0/0` administrative ports.

### 20.3 Create the EKS cluster

The IaC definition should include:

- a supported Kubernetes minor;
- private cluster endpoint where operationally possible;
- a tightly restricted public endpoint only if required;
- control-plane audit, API, authenticator, controller-manager, and scheduler
  logs;
- encryption for persistent volumes and Secrets at rest;
- access entries rather than broad, hand-edited `aws-auth` mappings;
- managed node groups or an approved autoscaling model;
- IMDSv2 and restricted instance metadata access;
- mandatory ownership, environment, data-classification, and cost tags.

AWS Console verification:

1. **EKS** → **Clusters** → `<CLUSTER_NAME>` → **Overview**.
2. Confirm status `Active`, Kubernetes version, VPC, subnet selection, and
   endpoint access.
3. **Observability** → confirm required control-plane log types are enabled.
4. **Access** → confirm access entries and policies; remove bootstrap-wide
   administrative access when no longer needed.
5. **Compute** → confirm nodes are in private subnets and span Availability
   Zones.
6. **Update history** → confirm no failed updates.

CLI verification:

```bash
aws eks update-kubeconfig \
  --name <CLUSTER_NAME> \
  --region <AWS_REGION> \
  --alias <CLUSTER_CONTEXT>

kubectl config use-context <CLUSTER_CONTEXT>
kubectl get --raw=/readyz
kubectl get nodes -L topology.kubernetes.io/zone
kubectl auth can-i --list
```

Use a separate, least-privilege operator identity for normal administration.

### 20.4 Install and verify required EKS add-ons

Manage add-on versions in IaC and confirm compatibility before cluster upgrades:

- Amazon VPC CNI, with NetworkPolicy explicitly enabled when it is the selected
  policy engine;
- CoreDNS;
- kube-proxy;
- EKS Pod Identity Agent if using Pod Identity;
- Amazon EBS CSI driver;
- metrics-server;
- AWS Load Balancer Controller;
- External Secrets Operator;
- node autoscaler, when selected.

AWS Console:

1. EKS cluster → **Add-ons**.
2. Open each add-on.
3. Confirm `Active`, compatible version, IAM role/identity association, and no
   unresolved health issue.

Kubernetes:

```bash
kubectl -n kube-system get pods
kubectl get csidrivers
kubectl get storageclass
kubectl top nodes
```

Amazon VPC CNI NetworkPolicy enforcement is not enabled merely because the CNI
add-on is installed. Manage the add-on configuration through IaC with
`enableNetworkPolicy` set to `true`, confirm the pinned VPC CNI version and node
kernel meet its requirements, and verify the network-policy agent is healthy:

```bash
aws eks describe-addon \
  --cluster-name <CLUSTER_NAME> \
  --addon-name vpc-cni \
  --region <AWS_REGION>

kubectl -n kube-system get daemonset aws-node
kubectl -n kube-system get pods \
  -l k8s-app=aws-node \
  -o jsonpath='{range .items[*]}{.metadata.name}{" containers="}{range .spec.containers[*]}{.name}{" "}{end}{"\n"}{end}'
```

The exact add-on configuration JSON is versioned and belongs in IaC. Confirm
that the network-policy agent container is present and ready, then run the
allowed/denied tests from section 19.9 against a non-production namespace.
NetworkPolicy YAML without an enforcing policy engine is not a control.

For EBS:

- make gp3 the intentional default StorageClass;
- enable volume expansion;
- use encrypted volumes and an approved KMS key;
- create and delete a disposable PVC before relying on stateful workloads.

### 20.5 Configure ECR

Create one repository per deployable service:

```text
three-tier/backend
three-tier/frontend
```

Required policies:

- immutable tags in production;
- enhanced/basic scanning according to the organization standard;
- lifecycle policy for unreferenced CI images;
- KMS encryption if required;
- cross-account policy only for explicitly approved accounts.

Console:

1. **Elastic Container Registry** → **Private registry** → **Repositories**.
2. Open each repository → **Images**.
3. Confirm the CI tag, `sha256` digest, pushed time, scan state, and size.
4. Confirm no pipeline attempts to overwrite `latest`.
5. Open **Permissions** and **Lifecycle policy** and compare with IaC.

The agent IAM role should push only to the two approved repositories. Node roles
need pull access, not push access.

### 20.6 Install AWS Load Balancer Controller

Use the controller’s official EKS installation procedure for the selected
version. Associate its Kubernetes ServiceAccount with a least-privilege IAM role
using EKS Pod Identity or IRSA. Do not place AWS access keys in Helm values.

Verify:

```bash
kubectl -n kube-system rollout status \
  deployment/aws-load-balancer-controller \
  --timeout=300s

kubectl -n kube-system logs \
  deployment/aws-load-balancer-controller \
  --since=10m

kubectl get ingressclass
```

Production Ingress concepts:

```yaml
spec:
  ingressClassName: alb
metadata:
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP":80},{"HTTPS":443}]'
    alb.ingress.kubernetes.io/ssl-redirect: "443"
    alb.ingress.kubernetes.io/certificate-arn: <ACM_CERTIFICATE_ARN>
    alb.ingress.kubernetes.io/healthcheck-path: /healthz
```

The only public backend is the frontend Service. Nginx performs `/api`
proxying. Use an internal ALB when the application is private.

Console after reconciliation:

1. **EC2** → **Load Balancers** → select the Argo-created ALB.
2. Confirm scheme, subnets, security groups, HTTPS listener, and certificate.
3. **Target Groups** → **Targets** → all expected targets are `Healthy`.
4. Open **Health checks** and confirm `/healthz`, port, interval, and success
   codes.
5. Confirm HTTP redirects to HTTPS.

If targets are unhealthy, inspect controller events before loosening security
groups:

```bash
kubectl -n <APP_NAMESPACE> describe ingress <INGRESS_NAME>
kubectl -n <APP_NAMESPACE> get events \
  --sort-by=.metadata.creationTimestamp
```

### 20.7 DNS, TLS, and WAF

1. Request/validate the certificate in **Certificate Manager**. The certificate
   must be in the ALB region.
2. In **Route 53** → **Hosted zones** → the application zone, create an alias
   record to the ALB, preferably through GitOps/IaC.
3. Attach an approved AWS WAF web ACL where required.
4. Enable ALB access logs to a protected S3 bucket if required by policy.
5. Configure TLS policy, security headers, and HSTS deliberately.

Validate:

```bash
dig +short <APPLICATION_FQDN>
curl --fail --show-error --location \
  https://<APPLICATION_FQDN>/healthz
curl --fail --show-error \
  https://<APPLICATION_FQDN>/api/items
```

In browser Developer Tools → **Network**, select the document and an API
request. Confirm HTTPS, no mixed content, the expected status, security headers,
and `x-request-id`.

### 20.8 Production database

Choose one deliberately:

| Option | Requirement |
|---|---|
| MongoDB Atlas | Private connectivity/peering, TLS, least-privilege database user, backups, tested restore |
| Amazon DocumentDB | Compatibility testing, TLS trust bundle, supported query/index behavior, `retryWrites=false` where required |

Do not describe DocumentDB as a drop-in MongoDB replacement. Validate this
application’s CRUD queries, regex behavior, indexes, connection failover, driver
options, and backup restoration against the selected service.

Network:

- database is not public;
- database security group permits only the approved backend security group or
  subnet/pod identity path;
- frontend and Jenkins do not have database access;
- credentials come from Secrets Manager through External Secrets;
- TLS verification remains enabled.

AWS Console for DocumentDB:

1. **Amazon DocumentDB** → **Clusters** → select the cluster.
2. Confirm instances span Availability Zones.
3. Open **Connectivity & security** and inspect subnet group and security
   groups.
4. Open **Configuration** and confirm parameter group and encryption.
5. Open **Maintenance & backups** and confirm retention/window.
6. Open **Monitoring** and confirm alarms and Performance Insights-equivalent
   visibility selected for the service.

Run a restore drill into an isolated environment and record elapsed recovery
time. A green backup status is not proof of recoverability.

### 20.9 Production secrets and workload identity

Complete section 22 before deploying the backend. Confirm:

- Secret exists in AWS Secrets Manager;
- External Secrets controller identity can read only the required secret ARN;
- generated Kubernetes Secret name matches the Deployment;
- application Pod has no AWS static access-key environment variables;
- secret value does not appear in Argo CD diffs, Helm values, logs, Jenkins, or
  email.

### 20.10 Availability and autoscaling

Production defaults:

- frontend/backend replicas distributed across at least two zones;
- topology spread constraints or pod anti-affinity;
- HPA based on measured resource requests and load tests;
- PDB compatible with the minimum healthy replica count;
- node autoscaling with tested capacity constraints;
- rolling update parameters that preserve capacity;
- alerting for unavailable replicas, pending Pods, HPA saturation, node
  pressure, and ALB unhealthy targets.

Exercise:

1. generate controlled load in staging;
2. watch `kubectl get hpa -w`;
3. confirm replicas increase and new targets become healthy;
4. stop load and confirm stable scale-down;
5. drain one non-critical staging node and confirm the PDB/workload behavior;
6. record saturation point and rollback the test data.

### 20.11 Logging, backups, and upgrade policy

Enable and retain:

- EKS control-plane logs;
- application logs through Alloy/Loki;
- ALB access logs where required;
- VPC Flow Logs;
- CloudTrail;
- ECR and GitOps history;
- database backups;
- IaC state backups and locking;
- Jenkins configuration/job backup;
- Argo CD declarative configuration in Git.

For every Kubernetes upgrade:

1. read EKS and upstream release notes;
2. check deprecated APIs in rendered manifests;
3. check controller/add-on compatibility;
4. upgrade a non-production cluster;
5. run the complete acceptance suite;
6. upgrade control plane, add-ons, then nodes in the documented order;
7. verify workloads, policies, storage, metrics, and logs.

### 20.12 EKS production exit gate

Do not approve production until all are true:

- cluster and add-ons report healthy;
- nodes span required zones;
- EBS test PVC binds and is recoverable;
- ALB HTTPS targets are healthy;
- DNS and certificate validate;
- only frontend is publicly routed;
- ECR workload images are deployed by digest;
- Argo reports exact Git revision `Synced` and `Healthy`;
- External Secrets has no synchronization error;
- one complete CRUD transaction succeeds;
- Sonar, Trivy, tests, and ZAP staging gates passed;
- Prometheus target is up;
- backend/frontend logs are queryable by deployment version;
- alert delivery was tested;
- backup restore and rollback drills have recorded evidence.

---

## 21. Argo CD installation and GitOps operation

Argo CD owns continuous delivery. Jenkins builds and verifies artifacts, then
changes desired state in Git. Jenkins does not run `helm upgrade` or receive a
production cluster-admin kubeconfig.

### 21.1 Install a pinned Argo CD release

Prefer a reviewed Helm values file in the platform IaC/GitOps repository:

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm search repo argo/argo-cd --versions | head

helm upgrade --install argocd argo/argo-cd \
  --namespace argocd \
  --create-namespace \
  --version <PINNED_ARGO_CD_CHART_VERSION> \
  --values platform/argocd/values.yaml \
  --wait \
  --timeout 10m
```

Minimum production values:

- fixed chart/application version;
- HA components and resources sized for the cluster;
- Redis authentication/HA according to the chart design;
- HTTPS ingress or internal authenticated access;
- SSO/OIDC and role mapping;
- admin account disabled after bootstrap;
- repository credentials from a Secret-management workflow;
- metrics and ServiceMonitors;
- NetworkPolicies;
- no anonymous access;
- notifications only to approved destinations.

Verify:

```bash
kubectl -n argocd get pods
kubectl -n argocd rollout status \
  deployment/argocd-server --timeout=300s
kubectl -n argocd get events \
  --sort-by=.metadata.creationTimestamp
```

### 21.2 Access the UI safely

Lab:

```bash
kubectl -n argocd port-forward \
  --address 127.0.0.1 \
  service/argocd-server \
  8443:443
```

If remote, tunnel `8443` through SSH. Open
`https://127.0.0.1:8443` and accept only the expected lab certificate.

The bootstrap password can be read in a private terminal:

```bash
argocd admin initial-password -n argocd
```

Sign in, rotate the password immediately, verify the new credential, then delete
the initial-secret path according to the installed version’s guidance.

Production uses authenticated HTTPS and SSO. Do not expose a port-forward on
`0.0.0.0`.

### 21.3 Add the GitOps repository

Preferred authentication order:

1. GitHub App with only the GitOps repository selected;
2. read-only deploy key for Argo CD;
3. narrowly scoped token only if the first two are unavailable.

UI:

1. **Settings** → **Repositories** → **Connect Repo**.
2. Choose the correct connection method.
3. Enter the repository URL and credential reference.
4. Select **Connect**.
5. Expected status: `Successful`.

Never paste a developer’s broad personal token into a shared Argo CD instance.

### 21.4 Define an AppProject

The project restricts source repositories, destination clusters/namespaces, and
resource kinds:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: three-tier
  namespace: argocd
spec:
  description: Three-tier CRUD application
  sourceRepos:
    - <GITOPS_REPOSITORY_URL>
  destinations:
    - namespace: three-tier-lab
      server: https://kubernetes.default.svc
    - namespace: three-tier-dev
      server: https://kubernetes.default.svc
    - namespace: three-tier-staging
      server: https://kubernetes.default.svc
    - namespace: three-tier-prod
      server: https://kubernetes.default.svc
  clusterResourceWhitelist:
    - group: ""
      kind: Namespace
  namespaceResourceWhitelist:
    - { group: "", kind: ConfigMap }
    - { group: "", kind: Service }
    - { group: "", kind: ServiceAccount }
    - { group: apps, kind: Deployment }
    - { group: apps, kind: StatefulSet }
    - { group: autoscaling, kind: HorizontalPodAutoscaler }
    - { group: policy, kind: PodDisruptionBudget }
    - { group: networking.k8s.io, kind: Ingress }
    - { group: networking.k8s.io, kind: NetworkPolicy }
    - { group: gateway.networking.k8s.io, kind: Gateway }
    - { group: gateway.networking.k8s.io, kind: HTTPRoute }
    - { group: external-secrets.io, kind: SecretStore }
    - { group: external-secrets.io, kind: ExternalSecret }
    - { group: monitoring.coreos.com, kind: ServiceMonitor }
    - { group: monitoring.coreos.com, kind: PrometheusRule }
```

Keep only cluster-scoped `Namespace` permission for Argo’s
`CreateNamespace=true` workflow. Platform CRDs, GatewayClass, ClusterRoles, and
storage classes are owned by platform GitOps, not this project. Revisit the
allowlist whenever chart kinds change.

### 21.5 Define lab, development, staging, and production Applications

Lab:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: three-tier-lab
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: three-tier
  source:
    repoURL: <GITOPS_REPOSITORY_URL>
    targetRevision: main
    path: charts/three-tier-app
    helm:
      valueFiles:
        - values-lab.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: three-tier-lab
  syncPolicy:
    managedNamespaceMetadata:
      labels:
        environment: lab
        app.kubernetes.io/part-of: three-tier-crud
        observability: enabled
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true
```

The lab’s platform-owned `GatewayClass` and non-Git MongoDB credential Secrets
must exist before this Application becomes healthy.

Staging:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: three-tier-staging
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: three-tier
  source:
    repoURL: <GITOPS_REPOSITORY_URL>
    targetRevision: main
    path: charts/three-tier-app
    helm:
      valueFiles:
        - values-staging.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: three-tier-staging
  syncPolicy:
    managedNamespaceMetadata:
      labels:
        environment: staging
        app.kubernetes.io/part-of: three-tier-crud
        observability: enabled
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true
```

Create `app-dev.yaml` from the same schema with:

```text
metadata.name: three-tier-dev
helm.valueFiles: [values-dev.yaml]
destination.namespace: three-tier-dev
managedNamespaceMetadata.labels.environment: dev
managedNamespaceMetadata.labels.observability: enabled
automated prune/selfHeal: enabled
```

Create `app-prod.yaml` with:

```text
metadata.name: three-tier-prod
helm.valueFiles: [values-prod.yaml]
destination.namespace: three-tier-prod
managedNamespaceMetadata.labels.environment: prod
managedNamespaceMetadata.labels.observability: enabled
automated: omitted
syncOptions: [CreateNamespace=true, PruneLast=true]
```

The canonical production policy is an approved digest-only GitOps pull request
followed by an authorized manual Argo sync. It does not rebuild source. If the
organization later adopts automated production sync, change the Application,
approval procedure, and audit evidence together; do not mix ad hoc methods.

Before enabling `prune`, render the chart and inspect Argo’s deletion preview.
The `resources-finalizer` means deleting the Application can delete its managed
resources. Treat that as destructive.

Apply:

```bash
kubectl apply -f argocd/project.yaml
kubectl apply -f argocd/app-lab.yaml
kubectl apply -f argocd/app-dev.yaml
kubectl apply -f argocd/app-staging.yaml
kubectl apply -f argocd/app-prod.yaml
```

Apply only the environment Applications that belong on the current cluster.
Use the filenames that actually exist. The original draft created one filename
and applied a different one.

### 21.6 Understand Helm and Argo CD ownership

Argo CD uses Helm as a manifest renderer. There is no Helm release for Argo to
“upgrade” or “rollback.” Argo compares rendered desired resources with live
resources and applies the difference.

Therefore:

- `helm lint` and `helm template` run before merge;
- Argo performs reconciliation after merge;
- operators do not run `helm upgrade` against the same release;
- operators avoid `kubectl edit` because self-heal may revert it;
- desired changes and reversions belong in Git.

### 21.7 Configure Git webhook refresh

Argo polls Git, but a repository webhook accelerates refresh.

GitHub:

1. GitOps repository → **Settings** → **Webhooks** → **Add webhook**.
2. Payload URL: the authenticated Argo CD webhook endpoint.
3. Content type: `application/json`.
4. Secret: a generated webhook secret stored by Argo CD.
5. Select push events for the GitOps repository.
6. Save and inspect **Recent Deliveries**.

Expected:

- delivery status `2xx`;
- Argo refreshes the intended Application;
- invalid signatures are rejected;
- the webhook does not grant Git write access.

### 21.8 Give Jenkins read-only deployment visibility

For auto-synced staging, Jenkins needs only enough Argo permission to read the
Application and wait for status. It does not need cluster-admin.

Create an Argo project role whose policy permits `get` on the staging
Application, generate a token, and store it as Jenkins Secret text
`argocd-staging-read-token`.

Bind the token only around the wait:

```groovy
withCredentials([string(
    credentialsId: 'argocd-staging-read-token',
    variable: 'ARGOCD_AUTH_TOKEN'
)]) {
    withEnv(['ARGOCD_SERVER=<ARGOCD_HOST>']) {
        sh 'ci/wait-for-argo-revision.sh'
    }
}
```

Check in `ci/wait-for-argo-revision.sh` containing the exact bounded
revision/status/live-manifest procedure in section 16.10. Pass
`ARGO_APP`, `GITOPS_REVISION`, `IMAGE_FULL`, and `IMAGE_DIGEST`; never replace
it with a plain health wait. Only after the exact commit and live digest match
may smoke tests and ZAP run.

### 21.9 Argo CD UI verification

1. **Applications** → **three-tier-staging**.
2. **Summary**:
   - Sync status is `Synced`;
   - Health status is `Healthy`;
   - revision equals the expected GitOps commit.
3. **Tree**:
   - Namespace, Deployments, ReplicaSets, Pods, Services, Ingress, HPA, PDB,
     ServiceMonitor, and ExternalSecret show expected health;
   - no orphan or unexplained resource.
4. Select a Deployment → **Manifest**:
   - image is `repository@sha256:...`;
   - probes, resources, and security context are present.
5. Select a Pod → **Logs** and **Events**:
   - no restart loop;
   - logs do not contain secrets.
6. **History and Rollback**:
   - verify revisions exist;
   - do not use rollback while automatic sync is enabled.

### 21.10 Drift and sync failure diagnosis

```bash
argocd app get three-tier-staging
argocd app diff three-tier-staging
argocd app resources three-tier-staging

kubectl -n argocd logs \
  deployment/argocd-repo-server \
  --since=10m
kubectl -n argocd logs \
  statefulset/argocd-application-controller \
  --since=10m
```

Common categories:

| Symptom | Inspect |
|---|---|
| `ComparisonError` | repository access, path, values filename, Helm render |
| `OutOfSync` immediately returns | self-mutating controller/defaulted field, ignore-difference policy |
| `Progressing` | Deployment rollout, probes, PVC, target health |
| `Degraded` | resource health message and Kubernetes Events |
| `Unknown` | Argo controller/repository availability |
| Prune blocked | finalizers, PDB, admission policy, permissions |

Never solve drift by disabling validation globally.

---

## 22. Secret management

### 22.1 Canonical secret inventory

| Secret | System of record | Consumer | Jenkins credential ID / K8s name |
|---|---|---|---|
| Application repository read | GitHub App/deploy key | Jenkins | `github-app-read` |
| GitOps repository write | GitHub App/deploy key | Jenkins | `github-gitops-write` |
| Docker Hub lab token | Docker Hub | Jenkins | `dockerhub-creds` |
| Sonar token | SonarQube | Jenkins | supplied by Jenkins Sonar server configuration |
| Argo staging read token | Argo CD | Jenkins | `argocd-staging-read-token` |
| SMTP credential | mail provider | Jenkins/Alertmanager | `smtp-notifier` / `smtp-credentials` |
| Mongo-compatible URI | AWS Secrets Manager | backend | Kubernetes `backend-secrets`, key `MONGO_URI` |
| ZAP authenticated test identity | approved identity store | Jenkins staging scan | `zap-staging-context` |

Delete unused duplicate IDs from the drafts. A credential ID is an interface;
spelling differences are breaking configuration changes.

### 22.2 Jenkins credential rules

Jenkins → **Manage Jenkins** → **Credentials**:

1. Select the narrowest appropriate domain.
2. Select **Global credentials** only when multiple intended jobs need it.
3. Choose the correct type: Secret text, username/password, SSH key, or
   certificate.
4. Enter the exact ID from section 7.
5. Add owner, purpose, and rotation date in the description.

Pipeline rules:

- scope credentials to the smallest `withCredentials` block;
- use single-quoted Groovy shell strings so the shell, not Groovy, expands
  secret variables;
- use `set +x` around authentication;
- never interpolate credentials into a URL;
- never archive credential-bearing files;
- clean workspaces and temporary Docker configs;
- never email environment dumps or console logs.

Jenkins masking is a last line of defense, not proof that a secret cannot leak
through transformed output, process arguments, or files.

### 22.3 Create authenticated lab database Secrets without committing them

Generate distinct root and application passwords with the approved password
manager. Restrict usernames/database names to the reviewed values below, then
use protected files rather than literal secret command-line arguments:

```bash
umask 077
MONGO_BOOTSTRAP_FILE="$(mktemp)"
BACKEND_SECRET_FILE="$(mktemp)"
trap 'rm -f "${MONGO_BOOTSTRAP_FILE}" "${BACKEND_SECRET_FILE}"' EXIT

read -rsp "Lab MongoDB root password: " MONGO_ROOT_PASSWORD
printf '\n'
read -rsp "Lab MongoDB application password: " MONGO_APP_PASSWORD
printf '\n'

printf '%s\n' \
  'MONGO_INITDB_ROOT_USERNAME=mongo_admin' \
  "MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}" \
  'MONGO_APP_USERNAME=crud_app' \
  "MONGO_APP_PASSWORD=${MONGO_APP_PASSWORD}" \
  'MONGO_APP_DATABASE=crudapp' \
  > "${MONGO_BOOTSTRAP_FILE}"

ENCODED_APP_PASSWORD="$(
  printf '%s' "${MONGO_APP_PASSWORD}" | jq -sRr @uri
)"
printf '%s\n' \
  "MONGO_URI=mongodb://crud_app:${ENCODED_APP_PASSWORD}@mongodb-0.mongodb-svc.three-tier-lab.svc.cluster.local:27017/crudapp?authSource=crudapp" \
  > "${BACKEND_SECRET_FILE}"

unset MONGO_ROOT_PASSWORD MONGO_APP_PASSWORD ENCODED_APP_PASSWORD

kubectl -n three-tier-lab create secret generic mongodb-bootstrap \
  --from-env-file="${MONGO_BOOTSTRAP_FILE}" \
  --dry-run=client -o yaml |
  kubectl apply -f -

kubectl -n three-tier-lab create secret generic backend-secrets \
  --from-env-file="${BACKEND_SECRET_FILE}" \
  --dry-run=client -o yaml |
  kubectl apply -f -
```

The StatefulSet maps all five bootstrap keys to container environment
variables, mounts a non-secret initialization script, and starts
`mongod --bind_ip_all --auth`. The script runs on only a new empty volume and
creates `crud_app` with `readWrite` on `crudapp`, using `process.env` inside
`mongosh`. The backend maps only `backend-secrets/MONGO_URI`.

Verify metadata/key names without printing data:

```bash
kubectl -n three-tier-lab get secret \
  mongodb-bootstrap backend-secrets
kubectl -n three-tier-lab get secret mongodb-bootstrap \
  -o go-template='keys={{range $key, $_ := .data}}{{$key}} {{end}}{{"\n"}}'
kubectl -n three-tier-lab get secret backend-secrets \
  -o go-template='keys={{range $key, $_ := .data}}{{$key}} {{end}}{{"\n"}}'
```

Never run `kubectl get secret ... -o yaml` in a shared console or attach its
output to a ticket. If the PVC already contains MongoDB data, do not assume the
init script reruns; follow an authenticated user-rotation procedure.

### 22.4 Store the production database secret

AWS Console:

1. **Secrets Manager** → **Store a new secret**.
2. Select an appropriate secret type.
3. Store key `MONGO_URI`; do not split a URI into values that the application
   does not consume.
4. Name it using the approved hierarchy, for example
   `three-tier/prod/backend`.
5. Select the approved KMS key.
6. Add owner/environment tags.
7. Configure rotation only after the application and database support the
   chosen rotation method.

Open the saved secret:

- **Overview**: verify ARN, KMS key, description, and tags;
- **Permissions**: verify no broad principal;
- **Rotation**: verify status and next rotation;
- **Versions**: verify current/staging labels during a planned rotation.

Do not click **Retrieve secret value** merely as a routine health check.

### 22.5 Install External Secrets Operator

```bash
helm repo add external-secrets \
  https://charts.external-secrets.io
helm repo update

helm upgrade --install external-secrets \
  external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --version <PINNED_EXTERNAL_SECRETS_CHART_VERSION> \
  --set installCRDs=true \
  --wait \
  --timeout 10m
```

Choose exactly one identity mode:

| Mode | AWS role is associated with | `SecretStore.auth` |
|---|---|---|
| EKS Pod Identity | ESO controller ServiceAccount `external-secrets/external-secrets` | Omitted |
| IRSA | namespaced ServiceAccount `three-tier-prod/external-secrets-app` | `jwt.serviceAccountRef` |

The role permits `secretsmanager:GetSecretValue` and
`secretsmanager:DescribeSecret` only on the approved secret ARN. If that secret
uses a customer-managed KMS key, also permit `kms:Decrypt` only on that key,
with a Secrets Manager encryption-context condition where supported. Do not
create static AWS keys and do not combine Pod Identity with
`serviceAccountRef`.

Verify:

```bash
kubectl -n external-secrets get pods
kubectl get crd externalsecrets.external-secrets.io
kubectl get crd secretstores.external-secrets.io
```

### 22.6 Define a SecretStore and ExternalSecret

IRSA creates and annotates the referenced ServiceAccount:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: external-secrets-app
  namespace: three-tier-prod
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::<ACCOUNT_ID>:role/<ESO_SECRET_ROLE>
automountServiceAccountToken: true
---
apiVersion: external-secrets.io/v1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: three-tier-prod
spec:
  provider:
    aws:
      service: SecretsManager
      region: <AWS_REGION>
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-app
```

For Pod Identity, associate the IAM role with
`external-secrets/external-secrets` using IaC/EKS Pod Identity and use this
store instead:

```yaml
apiVersion: external-secrets.io/v1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: three-tier-prod
spec:
  provider:
    aws:
      service: SecretsManager
      region: <AWS_REGION>
```

Use the same ExternalSecret with either store:

```yaml
---
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: backend-secrets
  namespace: three-tier-prod
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: SecretStore
    name: aws-secrets-manager
  target:
    name: backend-secrets
    creationPolicy: Owner
  data:
    - secretKey: MONGO_URI
      remoteRef:
        key: three-tier/prod/backend
        property: MONGO_URI
```

The API version and identity syntax must match the pinned External Secrets
release. Validate server-side before merge.

Backend Deployment:

```yaml
env:
  - name: MONGO_URI
    valueFrom:
      secretKeyRef:
        name: backend-secrets
        key: MONGO_URI
```

The Secret name must be identical in the ExternalSecret and Deployment. The
original drafts mixed release-derived and fixed names.

### 22.7 Verify synchronization without revealing data

```bash
kubectl -n three-tier-prod get \
  secretstore,externalsecret

kubectl -n three-tier-prod describe \
  externalsecret backend-secrets

kubectl -n three-tier-prod get secret backend-secrets \
  -o go-template='{{.metadata.name}} keys={{range $key, $_ := .data}}{{$key}} {{end}}{{"\n"}}'
```

Prefer the first two commands; even base64 data should not be printed.

Expected ExternalSecret condition:

```text
Type: Ready
Status: True
Reason: SecretSynced
```

In Argo CD, the ExternalSecret may be healthy while the generated Kubernetes
Secret is deliberately excluded from Git diff. Confirm that behavior is
intentional.

### 22.8 Rotation procedure

1. Create the new database credential and grant minimum permissions.
2. Update Secrets Manager with a new version.
3. Wait for External Secrets refresh or perform an approved refresh.
4. Roll the backend Deployment. The current process reads `MONGO_URI` and
   creates its Mongoose connection only at startup, so Secret refresh alone
   cannot activate the new credential.
5. Confirm readiness and a complete CRUD transaction.
6. Confirm old and new connections during the overlap window if supported.
7. Revoke the old credential.
8. Check logs, alerts, and database audit records.
9. Record the rotation evidence and next due date.

Never revoke the old credential before the new version is proven in the
application.

---

## 23. Prometheus, Grafana, and alerting

### 23.1 Install the monitoring stack

Create a reviewed values file and pin the chart:

```bash
helm repo add prometheus-community \
  https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --version <PINNED_KUBE_PROMETHEUS_STACK_CHART_VERSION> \
  --values platform/monitoring/values.yaml \
  --wait \
  --timeout 15m

kubectl label namespace monitoring \
  alertmanager-configs=enabled \
  --overwrite
```

The values file must define:

- persistent storage and retention;
- resource requests/limits;
- Grafana admin authentication through a Secret or SSO;
- ServiceMonitor and PrometheusRule selectors;
- AlertmanagerConfig selectors;
- ingress/authentication policy, if not localhost-only;
- backup and upgrade policy.

Selector baseline:

```yaml
prometheus:
  prometheusSpec:
    serviceMonitorSelectorNilUsesHelmValues: false
    serviceMonitorSelector:
      matchLabels:
        release: kube-prometheus-stack
    serviceMonitorNamespaceSelector:
      matchLabels:
        observability: enabled
    ruleSelectorNilUsesHelmValues: false
    ruleSelector:
      matchLabels:
        release: kube-prometheus-stack
    ruleNamespaceSelector:
      matchLabels:
        observability: enabled

alertmanager:
  alertmanagerSpec:
    alertmanagerConfigSelector:
      matchLabels:
        alertmanagerConfig: platform
    alertmanagerConfigNamespaceSelector:
      matchLabels:
        alertmanager-configs: enabled
    alertmanagerConfigMatcherStrategy:
      type: None
```

Label application namespaces `observability=enabled` through Argo
`managedNamespaceMetadata`; label only the `monitoring` namespace
`alertmanager-configs=enabled`. `type: None` is deliberate because the
platform-level config in `monitoring` must route application alerts from other
namespaces. Without an explicit matcher strategy, namespace enforcement can
make the route silently miss them.

Do not use chart defaults as an undocumented production architecture.

Install the monitoring stack and its CRDs before enabling the application
chart’s ServiceMonitor/PrometheusRule templates. Model that as a platform
Application dependency/sync wave and verify the CRDs; do not rely only on
resource filename order.

Verify:

```bash
kubectl -n monitoring get pods
kubectl -n monitoring get \
  prometheus,alertmanager,servicemonitor,prometheusrule
kubectl -n monitoring get pvc
```

### 23.2 Add the backend ServiceMonitor

The Service and container port must both be named `http`. The selector must
match the Service’s labels, not the Deployment’s labels by assumption.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: crud-backend
  namespace: <APP_NAMESPACE>
  labels:
    release: kube-prometheus-stack
spec:
  namespaceSelector:
    matchNames:
      - <APP_NAMESPACE>
  selector:
    matchLabels:
      app.kubernetes.io/name: backend
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
      scrapeTimeout: 10s
```

The `release` label is correct only if the pinned stack’s Prometheus selector
requires it. Inspect the rendered Prometheus custom resource:

```bash
kubectl -n monitoring get prometheus \
  kube-prometheus-stack-prometheus \
  -o yaml
```

NetworkPolicy must allow the actual Prometheus Pods in namespace `monitoring` to
backend port `5000`.

### 23.3 Verify the target

Port-forward locally:

```bash
kubectl -n monitoring port-forward \
  --address 127.0.0.1 \
  service/kube-prometheus-stack-prometheus \
  9090:9090
```

Open `http://127.0.0.1:9090`:

1. **Status** → **Targets**.
2. Search for `crud-backend`.
3. Expected state: `UP`.
4. Open the endpoint to confirm it is an internal ClusterIP address and path
   `/metrics`.
5. If down, inspect **Last Scrape**, **Last Error**, Service endpoints, and
   NetworkPolicy.

Query:

```promql
crud_app_http_requests_total
```

If no series exists, make one request through the application and query again.

### 23.4 Correct application queries

Request rate:

```promql
sum by (method, route) (
  rate(crud_app_http_requests_total{
    namespace="<APP_NAMESPACE>",
    service="backend-svc",
    route=~"/api/.*"
  }[5m])
)
```

Five-minute server-error ratio:

```promql
sum(rate(crud_app_http_requests_total{
  namespace="<APP_NAMESPACE>",
  service="backend-svc",
  route=~"/api/.*",
  status_code=~"5.."
}[5m]))
/
clamp_min(sum(rate(crud_app_http_requests_total{
  namespace="<APP_NAMESPACE>",
  service="backend-svc",
  route=~"/api/.*"
}[5m])), 0.000001)
```

P95 request latency:

```promql
histogram_quantile(
  0.95,
  sum by (le) (
    rate(crud_app_http_request_duration_seconds_bucket{
      namespace="<APP_NAMESPACE>",
      service="backend-svc",
      route=~"/api/.*"
    }[5m])
  )
)
```

Backend process CPU rate:

```promql
rate(crud_app_process_cpu_user_seconds_total{
  namespace="<APP_NAMESPACE>",
  service="backend-svc"
}[5m])
+
rate(crud_app_process_cpu_system_seconds_total{
  namespace="<APP_NAMESPACE>",
  service="backend-svc"
}[5m])
```

The original draft compared requests per second to `0.05` and called it a
five-percent error rate. A percentage alert must divide errors by total
requests.

### 23.5 Fix metric cardinality before production

The current structured logger maps unmatched routes to `unmatched`, but the
Prometheus middleware still falls back to `req.path`. Arbitrary paths can
therefore create unbounded `route` labels.

Change the metrics middleware to use:

```js
const route = req.route?.path || 'unmatched';
```

For mounted routers, include only a normalized base path and route template.
Never use:

- raw URL;
- query string;
- item ID;
- request ID;
- user agent;
- username/email

as a Prometheus label.

### 23.6 Add application alert rules

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: crud-backend
  namespace: <APP_NAMESPACE>
  labels:
    release: kube-prometheus-stack
spec:
  groups:
    - name: crud-backend.rules
      rules:
        - alert: CrudBackendHighErrorRatio
          expr: |
            (
              sum(rate(crud_app_http_requests_total{
                namespace="<APP_NAMESPACE>",
                service="backend-svc",
                route=~"/api/.*",
                status_code=~"5.."
              }[5m]))
              /
              clamp_min(
                sum(rate(crud_app_http_requests_total{
                  namespace="<APP_NAMESPACE>",
                  service="backend-svc",
                  route=~"/api/.*"
                }[5m])),
                0.000001
              )
            ) > 0.05
            and
            sum(rate(crud_app_http_requests_total{
              namespace="<APP_NAMESPACE>",
              service="backend-svc",
              route=~"/api/.*"
            }[5m])) > 0.1
          for: 10m
          labels:
            severity: warning
            service: crud-backend
          annotations:
            summary: Backend server-error ratio exceeds 5%
            description: >-
              More than 5% of observed backend requests have returned 5xx for
              ten minutes.
        - alert: CrudBackendP95LatencyHigh
          expr: |
            histogram_quantile(
              0.95,
              sum by (le) (
                rate(crud_app_http_request_duration_seconds_bucket{
                  namespace="<APP_NAMESPACE>",
                  service="backend-svc",
                  route=~"/api/.*"
                }[5m])
              )
            ) > 1
          for: 10m
          labels:
            severity: warning
            service: crud-backend
          annotations:
            summary: Backend P95 latency exceeds one second
        - alert: CrudBackendMetricsTargetMissing
          expr: |
            absent(up{
              namespace="<APP_NAMESPACE>",
              service="backend-svc"
            })
            or
            min(up{
              namespace="<APP_NAMESPACE>",
              service="backend-svc"
            }) == 0
          for: 5m
          labels:
            severity: critical
            service: crud-backend
          annotations:
            summary: Backend metrics target is absent or down
        - alert: CrudBackendDeploymentUnavailable
          expr: |
            kube_deployment_status_replicas_unavailable{
              namespace="<APP_NAMESPACE>",
              deployment="backend"
            } > 0
          for: 10m
          labels:
            severity: critical
            service: crud-backend
          annotations:
            summary: Backend Deployment has unavailable replicas
```

The minimum-traffic guard is mandatory in production. Render
`<APP_NAMESPACE>` from the Helm release namespace and confirm `service` and
`deployment` label values in live Prometheus before enabling the rules; do not
guess a job label such as `crud-backend`.

### 23.7 Configure Alertmanager safely

Example `AlertmanagerConfig` shape:

```yaml
apiVersion: monitoring.coreos.com/v1alpha1
kind: AlertmanagerConfig
metadata:
  name: platform-email
  namespace: monitoring
  labels:
    alertmanagerConfig: platform
spec:
  route:
    receiver: platform-email
    groupBy: [alertname, namespace, service]
    groupWait: 30s
    groupInterval: 5m
    repeatInterval: 4h
  receivers:
    - name: platform-email
      emailConfigs:
        - to: <ON_CALL_EMAIL>
          from: <ALERT_FROM_EMAIL>
          smarthost: <SMTP_HOST>:587
          sendResolved: true
          authUsername: <SMTP_USERNAME>
          authPassword:
            name: smtp-credentials
            key: password
          requireTLS: true
```

`authPassword` is a direct SecretKeySelector. The original draft’s nested
`secret` object was invalid.

Create the lab password Secret without exposing it in process arguments:

```bash
umask 077
SMTP_PASSWORD_FILE="$(mktemp)"
trap 'rm -f "${SMTP_PASSWORD_FILE}"' EXIT
read -rsp "Lab SMTP password: " SMTP_PASSWORD
printf '\n'
printf '%s' "${SMTP_PASSWORD}" > "${SMTP_PASSWORD_FILE}"
unset SMTP_PASSWORD

kubectl -n monitoring create secret generic smtp-credentials \
  --from-file=password="${SMTP_PASSWORD_FILE}" \
  --dry-run=client -o yaml |
  kubectl apply -f -
```

In production, store the password at an approved Secrets Manager path such as
`three-tier/prod/monitoring/smtp`, create a `monitoring`-namespace
SecretStore using exactly one identity pattern from section 22.6, and reconcile:

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: smtp-credentials
  namespace: monitoring
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: SecretStore
    name: aws-secrets-manager
  target:
    name: smtp-credentials
    creationPolicy: Owner
  data:
    - secretKey: password
      remoteRef:
        key: three-tier/prod/monitoring/smtp
        property: password
```

Verify only the key name:

```bash
kubectl -n monitoring get secret smtp-credentials \
  -o go-template='keys={{range $key, $_ := .data}}{{$key}} {{end}}{{"\n"}}'
```

Rotate it with a controlled test and confirm `sendResolved: true` produces both
firing and resolved messages.

The Alertmanager custom resource must select this `AlertmanagerConfig` label and
namespace. Confirm in the rendered stack values.

UI:

1. Prometheus → **Alerts**: rule is loaded and state is `Inactive`, `Pending`,
   or `Firing`, never missing.
2. Alertmanager → **Status**: receiver and route loaded.
3. Grafana → **Alerting** → **Alert rules**: rule is visible.
4. Run a controlled test alert routed to a test receiver.
5. Confirm one notification and one resolved notification.

Do not trigger a production-impacting condition merely to test email.

### 23.8 Grafana access and dashboards

Lab:

```bash
kubectl -n monitoring port-forward \
  --address 127.0.0.1 \
  service/kube-prometheus-stack-grafana \
  3001:80
```

Open `http://127.0.0.1:3001`. Retrieve the admin credential only in a private
terminal, rotate it, and use SSO in production.

UI verification:

1. **Connections** → **Data sources** → Prometheus → **Save & test**.
2. **Explore** → select Prometheus → run
   `crud_app_http_requests_total`.
3. **Dashboards** → create/import a reviewed Kubernetes dashboard.
4. Add application panels for request rate, error ratio, P95 latency, replicas,
   restarts, CPU/memory versus requests, and database readiness.
5. Set dashboard variables for environment and namespace.
6. Store dashboard JSON/provisioning in Git.

Do not rely on an internet dashboard ID without reviewing its queries,
datasources, permissions, and compatibility.

---

## 24. Loki and Grafana Alloy logging

Promtail is not part of this design. It reached end of life on 2026-03-02. Use
Grafana Alloy or another supported collector.

### 24.1 Current application logging contract

The audited backend now writes structured JSON to stdout/stderr.

Common fields:

| Field | Meaning | Loki label? |
|---|---|---|
| `timestamp` | UTC application timestamp | No; Loki already has an entry timestamp |
| `level` | `debug`, `info`, `warn`, or `error` | Optional only if bounded |
| `service` | default `crud-backend` | Prefer Kubernetes `app` label instead |
| `environment` | runtime environment | Use cluster/namespace label instead |
| `event` | bounded event name | Usually parse at query time |
| `request_id` | correlation identifier | **Never** a label |
| `http.method` | HTTP method | Parse at query time |
| `http.route` | normalized route | Parse at query time |
| `http.status_code` | response status | Parse at query time |
| `http.duration_ms` | request duration | Parse/unwrap at query time |
| `error` | sanitized error object | No |

Set in Kubernetes:

```yaml
env:
  - name: SERVICE_NAME
    value: crud-backend
  - name: LOG_LEVEL
    value: info
  - name: NODE_ENV
    value: production
```

Never log:

- `MONGO_URI` or database credentials;
- authorization/cookie headers;
- registry, GitHub, Sonar, Argo, AWS, or SMTP tokens;
- full request/response bodies;
- personal data unless explicitly classified and protected.

Frontend Nginx must use the JSON stdout format in section 8.7. It should emit
the same `request_id` it sends to the backend.

### 24.2 Request-ID propagation

Target flow:

```text
ALB/Ingress request ID, if approved
→ Nginx validates or creates X-Request-ID
→ Nginx logs it and forwards it
→ Express validates or creates it
→ Express returns X-Request-ID and logs it
```

The current Express validation limits the incoming value to 128 characters.
Also restrict it to a safe character set such as letters, digits, `_`, `-`, and
`.`. Do not accept control characters.

In Nginx, define a `map` at `http` scope to choose a valid incoming value or
`$request_id`; use that value consistently in `proxy_set_header`, response
header, and access log. Test:

```bash
curl -si \
  -H 'X-Request-ID: acceptance-123' \
  https://<STAGING_HOST>/api/items
```

Expected:

- response includes `X-Request-ID: acceptance-123`;
- frontend and backend logs contain the same value;
- Loki can find both entries without making the ID a stream label.

### 24.3 Install Loki for the lab

Current community chart behavior requires explicit `Monolithic` deployment
mode. A one-replica lab also requires replication factor `1`.

Create `platform/loki/values-lab.yaml`:

```yaml
loki:
  commonConfig:
    replication_factor: 1
  schemaConfig:
    configs:
      - from: "2024-04-01"
        store: tsdb
        object_store: s3
        schema: v13
        index:
          prefix: loki_index_
          period: 24h
  pattern_ingester:
    enabled: true
  limits_config:
    allow_structured_metadata: true
    volume_enabled: true
    retention_period: 168h
  rulerConfig:
    enable_api: true

deploymentMode: Monolithic

singleBinary:
  replicas: 1
  resources:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      cpu: "1"
      memory: 2Gi

# Temporary lab-only object storage.
# The built-in MinIO subchart is deprecated and is scheduled for removal.
ignoreMinioDeprecation: true
minio:
  enabled: true

backend: { replicas: 0 }
read: { replicas: 0 }
write: { replicas: 0 }
ingester: { replicas: 0 }
querier: { replicas: 0 }
queryFrontend: { replicas: 0 }
queryScheduler: { replicas: 0 }
distributor: { replicas: 0 }
compactor: { replicas: 0 }
indexGateway: { replicas: 0 }
bloomPlanner: { replicas: 0 }
bloomBuilder: { replicas: 0 }
bloomGateway: { replicas: 0 }
```

At this document revision, the built-in MinIO subchart is deprecated and
scheduled for removal on 2026-10-31. This workaround is temporary and lab-only.
Do not design production around it.

Install a pinned chart:

```bash
helm repo add grafana-community \
  https://grafana-community.github.io/helm-charts
helm repo update
helm search repo grafana-community/loki --versions | head

helm upgrade --install loki grafana-community/loki \
  --namespace loki \
  --create-namespace \
  --version <PINNED_LOKI_CHART_VERSION> \
  --values platform/loki/values-lab.yaml \
  --wait \
  --timeout 15m
```

Verify:

```bash
kubectl -n loki get pods,pvc
kubectl -n loki get service loki-gateway
kubectl -n loki logs \
  -l app.kubernetes.io/name=loki \
  --since=10m --tail=200
```

### 24.4 Production Loki storage

Production uses external object storage, not the embedded MinIO subchart.

For AWS:

- create unique S3 bucket names; do not use generic default names such as
  `chunk`, `ruler`, or `admin`;
- enable encryption, public-access block, versioning as required, lifecycle,
  ownership controls, and access logging;
- associate Loki’s ServiceAccount with a narrowly scoped IAM role through Pod
  Identity or IRSA;
- never put S3 access keys in Helm values;
- set tested retention and compactor behavior;
- choose Monolithic HA or a scalable deployment mode based on measured volume;
- use at least three replicas where the selected mode requires HA quorum;
- size caches, gateway, storage, query limits, and persistent volumes;
- monitor Loki itself and run a restore/query-availability exercise.

Representative storage concepts:

```yaml
loki:
  commonConfig:
    replication_factor: 3
  schemaConfig:
    configs:
      - from: "2024-04-01"
        store: tsdb
        object_store: s3
        schema: v13
        index:
          prefix: loki_index_
          period: 24h
  storage:
    type: s3
    bucketNames:
      chunks: <UNIQUE_CHUNKS_BUCKET>
      ruler: <UNIQUE_RULER_BUCKET>
      admin: <UNIQUE_ADMIN_BUCKET>
    s3:
      region: <AWS_REGION>
      s3ForcePathStyle: false
      insecure: false
  limits_config:
    retention_period: 672h

minio:
  enabled: false
```

Do not copy this fragment as a complete production values file. Merge it with
the exact pinned chart’s deployment-mode, persistence, resources, identity,
monitoring, and security settings.

AWS Console verification:

1. **S3** → each Loki bucket → **Permissions**: public access blocked.
2. **Properties**: encryption, versioning, lifecycle, and logging match IaC.
3. **IAM** → **Roles** → Loki role → trust policy and permissions include only
   the intended ServiceAccount and bucket prefixes.
4. **CloudTrail**: confirm Loki assumes the intended role, not a node-wide role.

### 24.5 Install Alloy

Create `platform/alloy/values.yaml`. This is the configuration pattern; validate
component syntax against the pinned Alloy release:

```yaml
controller:
  type: daemonset

serviceAccount:
  create: true

rbac:
  create: true

alloy:
  clustering:
    enabled: true
  configMap:
    create: true
    content: |-
      logging {
        level  = "info"
        format = "logfmt"
      }

      discovery.kubernetes "pods" {
        role = "pod"
      }

      discovery.relabel "pod_logs" {
        targets = discovery.kubernetes.pods.targets

        rule {
          source_labels = ["__meta_kubernetes_namespace"]
          target_label  = "namespace"
        }

        rule {
          source_labels = ["__meta_kubernetes_pod_name"]
          target_label  = "pod"
        }

        rule {
          source_labels = ["__meta_kubernetes_pod_container_name"]
          target_label  = "container"
        }

        rule {
          source_labels = [
            "__meta_kubernetes_pod_label_app_kubernetes_io_name",
          ]
          target_label = "app"
        }
      }

      loki.source.kubernetes "pod_logs" {
        targets    = discovery.relabel.pod_logs.output
        forward_to = [loki.process.pod_logs.receiver]

        clustering {
          enabled = true
        }
      }

      loki.process "pod_logs" {
        stage.static_labels {
          values = {
            cluster = "<CLUSTER_NAME>",
          }
        }

        forward_to = [loki.write.default.receiver]
      }

      loki.write "default" {
        endpoint {
          url = "http://loki-gateway.loki.svc.cluster.local/loki/api/v1/push"
        }
      }
```

Install:

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm upgrade --install alloy grafana/alloy \
  --namespace alloy \
  --create-namespace \
  --version <PINNED_ALLOY_CHART_VERSION> \
  --values platform/alloy/values.yaml \
  --wait \
  --timeout 10m
```

Verify:

```bash
kubectl -n alloy get pods
kubectl -n alloy logs daemonset/alloy \
  --since=10m --tail=200
```

Expected: no repeated authorization, duplicate-tail, parse, or Loki write
errors. Confirm the chart-generated RBAC does not grant unnecessary Secret
read access.

### 24.6 Keep Loki labels low-cardinality

Recommended stream labels:

```text
cluster
namespace
app
container
```

Optional after measuring cardinality:

```text
environment
level
```

Never label:

```text
request_id
raw path or URL
item ID
user ID
IP address
user agent
error message
pod UID
image digest
```

Those remain JSON fields or Kubernetes metadata queried on demand. High
cardinality makes Loki expensive and can destabilize ingestion/querying.

### 24.7 Add Loki as a Grafana datasource

Provisioning is preferred:

```yaml
apiVersion: 1
datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki-gateway.loki.svc.cluster.local
    isDefault: false
    editable: false
```

UI check:

1. Grafana → **Connections** → **Data sources** → **Loki**.
2. URL points to the internal gateway, not a public endpoint.
3. Select **Save & test**.
4. Expected: datasource connected successfully.

### 24.8 Useful LogQL queries

All backend logs:

```logql
{namespace="three-tier-staging", app="backend"}
```

Structured completed HTTP requests:

```logql
{namespace="three-tier-staging", app="backend"}
| json
| event="http_request_completed"
```

Backend server errors:

```logql
{namespace="three-tier-staging", app="backend"}
| json
| event="http_request_completed"
| http_status_code >= 500
```

Trace one request:

```logql
{namespace="three-tier-staging"}
| json
| request_id="acceptance-123"
```

Frontend upstream failures:

```logql
{namespace="three-tier-staging", app="frontend"}
| json
| upstream_status=~"5.."
```

Nested JSON extraction names can differ by Loki/Grafana version. In **Explore**,
expand one parsed entry and use the field name Grafana actually shows.

### 24.9 Grafana logging UI verification

1. **Explore** → select **Loki**.
2. Select the last 15 minutes.
3. Run the backend query.
4. Expand a line and confirm JSON parsing.
5. Filter one request ID and verify frontend/backend correlation.
6. Select **Live** only in a controlled session; do not leave expensive broad
   queries running.
7. Open **Log volume** and check for unexpected cardinality or ingestion gaps.

Generate one test request and measure ingestion delay. Alert if production log
ingestion or Loki canary health exceeds the approved threshold.

### 24.10 Logging failure diagnostics

```bash
kubectl -n alloy logs daemonset/alloy --since=15m
kubectl -n loki get pods
kubectl -n loki logs \
  -l app.kubernetes.io/name=loki \
  --since=15m

kubectl -n loki port-forward \
  --address 127.0.0.1 \
  service/loki-gateway \
  3100:80
curl --fail http://127.0.0.1:3100/ready
```

Check in this order:

1. application writes to stdout;
2. Alloy discovers the Pod;
3. RBAC permits log collection;
4. Alloy can resolve/reach Loki gateway;
5. Loki accepts writes;
6. storage is writable and not full;
7. Grafana time range, datasource, and labels are correct.

Do not “fix” missing logs by adding every field as a label.

---

## 25. Application security and reliability gaps

The platform controls do not make the current CRUD API production-safe by
themselves. These application items require decisions and tests before a real
production release.

### 25.1 Validate types before calling string methods

Current `POST` and `PUT` paths call `.trim()` on `name` without first proving it
is a string. A number, array, or object can cause a server error rather than a
controlled `400`.

Required behavior:

```js
if (typeof name !== 'string' || name.trim().length === 0) {
  return res.status(400).json({
    error: 'Item name must be a non-empty string',
  });
}
```

Apply equivalent type and size checks to `description` and `status`. Add tests
for `null`, number, boolean, array, object, empty/whitespace, and oversized
input.

### 25.2 Bound and escape search

Current search input is inserted into a MongoDB regular expression. Escape
regular-expression metacharacters, impose a short maximum search length, reject
invalid types, and set a bounded result size. Validate performance with indexes
against the chosen database.

Add:

- pagination (`limit` and cursor/page with maximum);
- deterministic sort;
- maximum query-string size at Nginx/Express;
- tests for regex metacharacters and pathological input;
- database query-time monitoring.

### 25.3 Authentication and authorization

The current CRUD and metrics routes have no application authentication or
authorization. Before exposing non-demo data:

- choose the identity provider and token/session model;
- define roles and item-level permissions;
- authenticate writes;
- protect browser sessions against CSRF when cookie-based;
- ensure CORS matches the exact origin model;
- separate human API access from Prometheus scrape access;
- add audit identity without logging tokens or personal data;
- test expired, invalid, replayed, and insufficient-privilege credentials.

If the intended service is intentionally public, document that threat model and
still add abuse prevention and write controls.

### 25.4 Rate limiting and abuse controls

Apply defense in depth:

- WAF/ALB rules for gross abuse;
- Nginx request/body/time limits;
- application rate limiting keyed by an authenticated subject where possible;
- bounded JSON body size;
- database timeouts;
- pagination;
- alerting on rejected requests.

Do not trust an arbitrary `X-Forwarded-For`. Express proxy trust must match the
actual ingress hops.

### 25.5 Health endpoints

Target backend endpoints:

| Endpoint | Meaning | Probe/use |
|---|---|---|
| `/live` | Node process/event loop can serve | liveness |
| `/ready` | required dependencies available | readiness |
| `/health` | human/operator summary | compatibility/operations |
| `/metrics` | Prometheus only | internal scrape |

Return minimal non-sensitive data. A database outage should mark readiness
false without repeatedly restarting a healthy Node process.

### 25.6 Security test additions

Add tests for:

- malformed JSON and unsupported content type;
- invalid ID and type-invalid bodies;
- oversized body/name/description/search;
- regex metacharacters;
- pagination boundaries;
- missing/invalid authentication;
- authorization by role/owner;
- CORS and security headers;
- request-ID validation/correlation;
- readiness when MongoDB is unavailable;
- normalized metrics labels for unmatched paths;
- clean shutdown without Jest `--forceExit`;
- container non-root/read-only behavior;
- deployed smoke and one complete browser/API CRUD path.

The current passing unit tests are a useful baseline, not evidence of these
controls.

---

## 26. OWASP ZAP dynamic testing

ZAP runs only after the exact staging digest is deployed, `Synced`, `Healthy`,
and smoke-tested.

### 26.1 Choose the right scan

| Target | Scan | Frequency |
|---|---|---|
| Frontend web application | Baseline passive scan | Each protected staging deployment |
| Backend OpenAPI | API scan | Each protected staging deployment after an OpenAPI contract exists |
| Disposable authenticated staging | Active/full scan | Scheduled or approved release test |
| Production | Passive external monitoring only unless explicitly approved | Never active by default |

A baseline scan of the backend root will not discover this CRUD API
effectively. Add and maintain `backend/openapi.yaml`, validate it in CI, and use
the API scanner.

At audit time, `backend/openapi.yaml` and the `security/` ZAP policy files do
not exist. They are Phase 0 deliverables, so API DAST is a declared missing
gate—not a passing gate—until they are reviewed and committed.

`DEPLOYMENT_URL` must be reachable from the scan container and must pass a
bounded readiness check immediately before ZAP:

```bash
case "${DEPLOYMENT_URL}" in
  https://*) ;;
  *) echo "Staging DAST requires an approved HTTPS URL" >&2; exit 1 ;;
esac

curl --fail --show-error \
  --retry 20 --retry-delay 3 --retry-all-errors \
  "${DEPLOYMENT_URL}/healthz"
```

For EKS staging, use private DNS/network routing from the trusted agent. For a
Minikube-only exercise, an approved lab job may bind a namespace-limited
kubeconfig, start a localhost-only `kubectl port-forward`, wait for `/healthz`,
set `DEPLOYMENT_URL` to that loopback port, and install an `EXIT` trap that
terminates the forward. Do not point ZAP at an assumed `localhost` service, a
developer’s manually maintained tunnel, Jenkins itself, or an endpoint whose
deployed digest was not just verified.

### 26.2 Check in the ZAP policy

Target repository structure:

```text
security/
├── zap-baseline.conf
├── zap-api.conf
├── zap-context.context             # only if it contains no secret
└── README.md
```

Generate a starting baseline config:

```bash
docker run --rm \
  -v "$(pwd)/security:/zap/wrk:rw" \
  <PINNED_ZAP_IMAGE> \
  zap-baseline.py \
  -t https://<STAGING_HOST> \
  -g zap-baseline.conf
```

Review every rule. Each entry’s `FAIL`, `WARN`, or `IGNORE` is a policy action,
not a vulnerability-severity synonym. Exceptions require owner, justification,
and expiry in `security/README.md`.

### 26.3 Understand exit codes

ZAP packaged scan meanings:

| Code | Meaning | Pipeline policy |
|---:|---|---|
| `0` | Success under configured policy | Pass |
| `1` | At least one configured `FAIL` | Fail |
| `2` | Warnings | Mark unstable during a time-bounded adoption period, otherwise fail |
| `3` | Tool/execution error | Fail as infrastructure error |

`-I` and `|| true` are prohibited in a gate because they can hide both findings
and scanner failure.

### 26.4 Jenkins frontend baseline stage

```groovy
stage('DAST - ZAP Baseline') {
    when {
        expression { env.DEPLOY_ENV == 'staging' }
    }
    steps {
        script {
            int zapStatus = sh(
                returnStatus: true,
                script: '''
                  set -u
                  mkdir -p reports/zap

                  docker run --rm \
                    --user "$(id -u):$(id -g)" \
                    --volume "$PWD/reports/zap:/zap/wrk:rw" \
                    --volume "$PWD/security:/zap/policy:ro" \
                    <PINNED_ZAP_IMAGE> \
                    zap-baseline.py \
                      -t "$DEPLOYMENT_URL" \
                      -c /zap/policy/zap-baseline.conf \
                      -r frontend-zap.html \
                      -J frontend-zap.json
                '''
            )

            if (zapStatus == 1) {
                error('ZAP policy FAIL')
            }
            if (zapStatus == 2) {
                unstable('ZAP warnings require review')
            }
            if (zapStatus != 0 && zapStatus != 2) {
                error("ZAP execution failed with code ${zapStatus}")
            }
        }
    }
}
```

Replace `<PINNED_ZAP_IMAGE>` with an approved image version and digest. Validate
that the chosen image supports the Jenkins agent UID. Do not use `chmod 777`.

### 26.5 Jenkins backend API scan

After adding a validated OpenAPI file:

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --volume "$PWD/reports/zap:/zap/wrk:rw" \
  --volume "$PWD/backend/openapi.yaml:/zap/openapi.yaml:ro" \
  --volume "$PWD/security:/zap/policy:ro" \
  <PINNED_ZAP_IMAGE> \
  zap-api-scan.py \
    -t /zap/openapi.yaml \
    -f openapi \
    -S \
    -c /zap/policy/zap-api.conf \
    -r backend-zap.html \
    -J backend-zap.json
```

`-S` disables the API scan’s active scanner for the routine per-deployment
gate. Run an active API scan only in an approved disposable staging window, and
remove `-S` only in that separately authorized job.

The OpenAPI `servers` URL must resolve to the deployed staging backend through
the public frontend/ingress route, or supply the documented target override
supported by the pinned scanner. Confirm the report target before accepting it.

### 26.6 Authentication

For authenticated testing:

- create a dedicated staging-only account with disposable data;
- store the credential in Jenkins;
- inject it only around the scan;
- use a ZAP context or automation plan with no embedded secret;
- exclude logout/destructive/admin endpoints as appropriate;
- delete created test records;
- revoke or rotate the account after the test window;
- never put auth headers in reports or console output.

Active scans require application-owner approval and an isolated environment.

### 26.7 Publish and inspect reports

Always archive JSON and HTML in `post { always { ... } }`. Use HTML Publisher
for the HTML report.

Jenkins UI:

1. Service branch job → build number.
2. **Stage View** → ZAP stage ran after Argo wait and smoke test.
3. **ZAP Report** or **Artifacts** → open the HTML.
4. Confirm target URL and scan timestamp.
5. Review **FAIL**, **WARN**, and excluded rules.
6. Confirm the build result matches the exit-code policy.

An empty/missing report is a scanner failure, not a clean result.

---

## 27. Jenkins email notifications

Email is a notification channel, not the system of record. Jenkins build status,
reports, Git, registry digests, and Argo state remain authoritative.

### 27.1 Configure SMTP

Install **Email Extension Plugin** only if email is required.

Jenkins UI:

1. **Manage Jenkins** → **Credentials** → add credential
   `smtp-notifier`.
2. **Manage Jenkins** → **System**.
3. Find **Extended E-mail Notification**.
4. Enter SMTP host and port, normally `587` for STARTTLS.
5. Enable authentication and select the credential.
6. Enable TLS/STARTTLS as required by the provider.
7. Set the system From address and default reply-to.
8. Use **Test configuration by sending test e-mail**.

Expected:

- message arrives at the test mailbox;
- TLS is used;
- sender/domain authentication passes the organization’s policy;
- Jenkins logs do not print the password.

Do not disable certificate verification to make SMTP work.

### 27.2 One shared notification helper

Avoid duplicated frontend/backend email blocks. A shared library or a small,
identical reviewed helper should include:

- service;
- branch and commit;
- build number and result;
- duration;
- first failed stage where available;
- Jenkins build URL;
- Sonar project link;
- report links;
- deployed environment/digest only when deployment actually occurred.

Example:

```groovy
post {
    success {
        emailext(
            to: "${env.NOTIFICATION_RECIPIENTS}",
            subject: "[PASS] ${env.JOB_NAME} #${env.BUILD_NUMBER}",
            mimeType: 'text/html',
            body: """
              <p>Service: ${env.SERVICE_LABEL}</p>
              <p>Commit: ${env.GIT_COMMIT_SHORT}</p>
              <p><a href="${env.BUILD_URL}">Open Jenkins build</a></p>
            """
        )
    }
    failure {
        emailext(
            to: "${env.NOTIFICATION_RECIPIENTS}",
            subject: "[FAIL] ${env.JOB_NAME} #${env.BUILD_NUMBER}",
            mimeType: 'text/html',
            body: """
              <p>Build failed. Inspect Jenkins for the first failed stage.</p>
              <p><a href="${env.BUILD_URL}">Open Jenkins build</a></p>
            """
        )
    }
}
```

Groovy interpolation shown here contains only non-secret build metadata. Escape
or constrain any value derived from an untrusted commit/branch name before
placing it in HTML.

### 27.3 Notification rules

- Do not claim “Argo CD updated” on PR builds or when the stage was skipped.
- Do not attach console logs, environment dumps, `.env`, scanner contexts, or
  Kubernetes Secret YAML.
- Link to access-controlled reports rather than attaching large files.
- Limit recipient lists by environment.
- Rate-limit repeated failures.
- Test success, failure, unstable, and recovery messages.
- Use Alertmanager, not Jenkins email, for runtime production incidents.

---

## 28. End-to-end acceptance and UI runbook

Run this after Phase 0 corrections and platform installation. Create one
evidence record per release containing:

```text
application repository commit
backend image repository and digest
frontend image repository and digest
GitOps repository commit
Jenkins backend/frontend build URLs
Sonar analysis IDs/status
Trivy and ZAP report links
Argo Application and deployed revision
cluster, namespace, and application URL
acceptance-test timestamp and operator
rollback candidate revision
```

### 28.1 UI destination map

Product editions can rename a menu slightly. Use the closest equivalent and
record the observed screen.

| System | Where to go | What must be visible |
|---|---|---|
| GitHub application repo | Repository → **Actions/Checks** and pull request → **Checks** | Required CI checks tied to the intended commit |
| GitHub webhook | Repository → **Settings** → **Webhooks** → webhook → **Recent Deliveries** | Latest push delivery is `2xx`; correct event and redacted payload |
| GitHub rules | Repository → **Settings** → **Rules** → **Rulesets** | Required reviews/checks, no force push/delete on protected branch |
| Jenkins | Dashboard → multibranch job → branch → build | Correct commit, cause, parameters, result, duration |
| Jenkins stages | Build → **Pipeline Overview** or **Stage View** | First failure is identifiable; deploy follows all gates |
| Jenkins tests | Build → **Test Result** | Non-zero test count, no hidden/missing report |
| Jenkins reports | Build → **Artifacts** / published HTML links | Coverage, Trivy, SBOM, and applicable ZAP files |
| SonarQube | **Projects** → service project → **Overview** | Same commit, Quality Gate `Passed` |
| SonarQube details | Project → **Issues**, **Security Hotspots**, **Measures** → **Coverage** | Reviewed hotspots, real coverage import, no missing LCOV |
| Docker Hub | Repository → **Tags** | Unique commit tag and matching digest; no branch overwrite of `latest` |
| ECR | **Repositories** → service → **Images** | Unique tag, digest, scan status, push time |
| GitOps GitHub repo | Commit/PR → **Files changed** | Only intended service/environment digest changed |
| Argo CD | **Applications** → environment app → **Summary** | `Synced`, `Healthy`, expected Git revision |
| Argo resource tree | Application → **Tree** → Deployment/Pod | Expected digest, ready replicas, no degraded child |
| EKS | **EKS** → cluster → **Overview/Compute/Add-ons** | Cluster/add-ons active, nodes healthy across zones |
| ALB | **EC2** → **Load Balancers** and **Target Groups** | HTTPS listener; intended targets healthy |
| Secrets Manager | Secret → **Overview/Rotation** | Correct ARN/KMS/tags/rotation; do not reveal value |
| Prometheus | **Status** → **Targets** | CRUD backend target `UP` |
| Prometheus | **Alerts** | Application rules loaded with expected state |
| Grafana metrics | **Explore** → Prometheus | Request metric returns current data |
| Grafana logs | **Explore** → Loki | Frontend/backend JSON logs and shared request ID |
| Grafana alerts | **Alerting** → **Alert rules** | Rule status and receiver behavior |
| ZAP | Jenkins build → **ZAP Report** | Correct deployed target, timestamp, policy result |
| Email | Approved test mailbox | Correct build state/link; no sensitive data |

### 28.2 Step 1 — confirm repository state

Application repository:

```bash
git status --short
git rev-parse HEAD
git remote -v
git diff --check
```

Expected:

- intended commit is reviewed;
- `.dockerignore` is tracked for both services;
- no `.env`, credentials, generated scanner context, or Secret YAML is tracked;
- Jenkinsfiles contain no unresolved production placeholders.

GitHub UI:

1. Open the target commit.
2. Confirm its signature/verification status according to policy.
3. Open the pull request **Files changed** tab.
4. Confirm no unrelated pipeline, credential-ID, or manifest change.
5. Confirm required reviewers and checks.

### 28.3 Step 2 — run local source gates

```bash
(cd backend && npm ci && npm run lint && npm run test:coverage)
(cd frontend && npm ci && npm run lint && npm test -- --coverage && npm run build)

test -s backend/coverage/lcov.info
test -s frontend/coverage/lcov.info
```

Expected after Phase 0:

- real lint executes;
- backend and frontend tests pass;
- LCOV exists;
- frontend build succeeds;
- coverage includes intended source, not only imported components.

### 28.4 Step 3 — verify webhook and branch discovery

GitHub:

1. Repository → **Settings** → **Webhooks**.
2. Open Jenkins webhook.
3. **Recent Deliveries** → select the push event.
4. Confirm request time, event type, target URL, and `2xx` response.
5. Use **Redeliver** only for a known transient delivery failure.

Jenkins:

1. Dashboard → `crud-backend` multibranch job.
2. Select **Scan Multibranch Pipeline Now** only if discovery has not occurred.
3. Confirm expected branches appear and deleted branches are orphaned according
   to retention policy.
4. Repeat for `crud-frontend`.

### 28.5 Step 4 — verify backend CI

Jenkins → backend job → deployment branch → latest build:

1. **Build Information**: commit equals the approved commit.
2. **Stage View**:
   - checkout/preflight passed;
   - install, real lint, tests, and build checks passed;
   - Sonar analysis and Quality Gate passed;
   - Trivy filesystem and image gates passed;
   - registry/GitOps stages ran only on an authorized branch;
   - Argo wait preceded smoke/DAST.
3. **Test Result**: 20 or more current tests, with no missing XML warning.
4. **Coverage Report**: contains actual backend source coverage.
5. **Artifacts**: Trivy JSON, SBOM, and applicable ZAP JSON/HTML.
6. **Console Output**: no secret, credential-bearing URL, `|| true` gate, or
   unexpected tool version.

If a stage is skipped, open its condition and confirm the skip is intentional
for that branch.

### 28.6 Step 5 — verify frontend CI

Jenkins → frontend job → deployment branch → latest build:

1. Commit equals the approved commit.
2. Job ran on the dedicated agent, not built-in/controller.
3. Real ESLint and React Hooks rules passed.
4. Vitest JUnit and LCOV were published.
5. A standalone `npm run build` passed before Docker build.
6. Sonar Quality Gate is active and passed.
7. Trivy reports exist.
8. Docker build did not inject an `/api`-suffixed API base.
9. GitOps update changed only the frontend digest.
10. Argo wait, smoke test, and ZAP used the staging URL.

### 28.7 Step 6 — verify SonarQube

For each project:

1. SonarQube → **Projects** → `crud-backend` or `crud-frontend`.
2. **Overview** → Quality Gate is passed.
3. Confirm branch and commit SHA.
4. **Measures** → **Coverage** → coverage is non-zero and source files appear.
5. **Issues** → filter `New Code` and review severity/type.
6. **Security Hotspots** → each hotspot has a reviewed status.
7. **Project Information** → analysis time aligns with Jenkins.

If Jenkins waits indefinitely:

- SonarQube project → **Administration** → **Webhooks**;
- confirm Jenkins URL ends `/sonarqube-webhook/`;
- open the last delivery;
- inspect Jenkins system logs and reverse-proxy access.

### 28.8 Step 7 — verify image identity

Record from Jenkins:

```text
backend repository@sha256:...
frontend repository@sha256:...
```

In ECR or Docker Hub:

1. Open the service repository.
2. Select the commit-specific tag.
3. Copy the digest.
4. Confirm it equals Jenkins output.
5. Confirm scan completed and policy result is acceptable.
6. Confirm the pushed image timestamp is from this build.

Production is rejected if Helm values use a mutable tag without the digest.

### 28.9 Step 8 — verify the GitOps change

GitHub GitOps repository:

1. Open the Jenkins-created commit or promotion pull request.
2. **Files changed**:
   - correct environment file;
   - correct service;
   - repository and digest are correct;
   - no other service digest changed;
   - no secret or generated noise.
3. Confirm chart lint, render, schema, policy, and server dry-run checks.
4. For production, confirm required platform-owner approval.
5. Merge through the protected branch workflow.

Record the resulting GitOps commit SHA.

### 28.10 Step 9 — verify Argo reconciliation

Argo CD:

1. Open the environment Application.
2. Confirm revision equals the recorded GitOps SHA.
3. Confirm `Synced` and `Healthy`.
4. Tree → frontend Deployment → **Manifest** → correct frontend digest.
5. Tree → backend Deployment → **Manifest** → correct backend digest.
6. Confirm desired/ready replicas.
7. Inspect Events for failed scheduling, mounts, admission, or probes.
8. Open **Diff**: expected to be empty or contain only a documented ignored
   field.

CLI:

```bash
export ARGO_APP=<ARGO_APP>
export GITOPS_REVISION=<RECORDED_FULL_GITOPS_SHA>
export IMAGE_FULL=<EXPECTED_REPOSITORY>
export IMAGE_DIGEST=<EXPECTED_SHA256_DIGEST>
ci/wait-for-argo-revision.sh
```

For a two-service release, run the live digest assertion for both frontend and
backend. A plain `argocd app wait --sync --health` is insufficient because it
can report the previous healthy revision.

### 28.11 Step 10 — verify Kubernetes and load balancer

```bash
kubectl config current-context
kubectl -n <APP_NAMESPACE> get \
  deploy,statefulset,pod,svc,ingress,endpointslice,hpa,pdb

kubectl -n <APP_NAMESPACE> get events \
  --sort-by=.metadata.creationTimestamp

kubectl -n <APP_NAMESPACE> get deploy backend frontend \
  -o jsonpath='{range .items[*]}{.metadata.name}{" => "}{.spec.template.spec.containers[0].image}{"\n"}{end}'
```

Expected:

- image strings match approved digests;
- Pods are ready without repeated restart;
- Services have endpoints;
- backend/database have no public load balancer;
- frontend Ingress has the expected address;
- HPA does not show unknown metrics;
- PDB matches replica policy.

EKS/EC2 UI:

1. EKS → cluster → **Resources** → Workloads/Services and networking.
2. EC2 → **Target Groups** → application target group.
3. Confirm all intended targets `Healthy`.
4. Confirm no unintended backend target group or public `/metrics`.

### 28.12 Step 11 — perform one disposable CRUD transaction

Use staging and a unique disposable name:

```bash
export ACCEPTANCE_BASE_URL=https://<STAGING_HOST>
export ACCEPTANCE_REQUEST_ID=acceptance-<BUILD_NUMBER>

curl --fail --show-error \
  "${ACCEPTANCE_BASE_URL}/healthz"

CREATE_RESPONSE="$(
  curl --fail --show-error \
    -H 'Content-Type: application/json' \
    -H "X-Request-ID: ${ACCEPTANCE_REQUEST_ID}" \
    -d '{
      "name": "CI acceptance item",
      "description": "safe to delete",
      "status": "pending"
    }' \
    "${ACCEPTANCE_BASE_URL}/api/items"
)"

printf '%s\n' "${CREATE_RESPONSE}" | jq .
ACCEPTANCE_ITEM_ID="$(
  printf '%s' "${CREATE_RESPONSE}" | jq -r '._id'
)"

curl --fail --show-error \
  "${ACCEPTANCE_BASE_URL}/api/items/${ACCEPTANCE_ITEM_ID}" |
  jq .

curl --fail --show-error \
  -X PUT \
  -H 'Content-Type: application/json' \
  -d '{"status":"completed"}' \
  "${ACCEPTANCE_BASE_URL}/api/items/${ACCEPTANCE_ITEM_ID}" |
  jq .

curl --fail --show-error \
  -X DELETE \
  "${ACCEPTANCE_BASE_URL}/api/items/${ACCEPTANCE_ITEM_ID}"
```

For an authenticated target, inject the approved staging credential without
printing it. Put cleanup in a trap or post-test action so a failed assertion
does not leave data.

Browser:

1. Open application over HTTPS.
2. Developer Tools → **Network**.
3. Create, edit, filter, and delete an item.
4. Select an API request:
   - path contains one `/api`, not `/api/api`;
   - expected status;
   - request/response ID;
   - no CORS or mixed-content failure.
5. Console has no runtime error.

### 28.13 Step 12 — verify metrics, logs, alerts, and ZAP

Prometheus:

1. Target is `UP`.
2. Query request counter and confirm it increased.
3. Query error ratio and P95 without syntax error.

Grafana:

1. Prometheus panels show the acceptance traffic.
2. Loki query for `${ACCEPTANCE_REQUEST_ID}` shows frontend and backend entries.
3. Parsed log status/duration is correct.

Jenkins:

1. ZAP report target is the same staging host.
2. Report time follows Argo health time.
3. Build result matches policy.

Alerting:

1. Application rules are loaded.
2. A controlled synthetic test reaches the approved test receiver.
3. Resolved notification arrives.

### 28.14 Step 13 — final release sign-off

The release approver compares:

- source commit;
- CI results;
- image digests;
- GitOps diff/commit;
- Argo deployed revision;
- Kubernetes live images;
- acceptance evidence.

All must describe the same release. “Pipeline green” alone is insufficient.

---

## 29. Promotion, rollback, and recovery

### 29.1 Promote the same artifact

Build once and promote the exact digest:

```text
PR validation
→ protected-branch image build
→ deploy digest to development
→ deploy same digest to staging
→ test
→ production GitOps pull request changes only approved digests
→ deploy same digest to production
```

Do not rebuild source for production; a rebuild can resolve different base
images or packages. Promotion evidence includes both frontend and backend
digests and compatibility results.

### 29.2 Normal rollback: revert Git

1. Identify the last known-good GitOps commit and image digests.
2. Confirm rollback compatibility, especially database schema/data.
3. Revert the bad GitOps commit through a reviewed pull request:

```bash
git revert <BAD_GITOPS_COMMIT>
git push origin <PROTECTED_ROLLBACK_BRANCH>
```

4. Merge through emergency-approved controls if urgency requires.
5. Record the full merge/revert commit as
   `EXPECTED_ROLLBACK_GITOPS_REVISION`.
6. Run the same bounded exact-revision helper from section 16.10 with that
   revision and the known-good digest:

```bash
export ARGO_APP=<ARGO_APP>
export GITOPS_REVISION=<EXPECTED_ROLLBACK_GITOPS_REVISION>
export IMAGE_FULL=<EXPECTED_REPOSITORY>
export IMAGE_DIGEST=<KNOWN_GOOD_SHA256_DIGEST>
ci/wait-for-argo-revision.sh
```

7. Repeat the live digest assertion for the other service, then run smoke/CRUD
   checks.
8. Record incident, root cause, and forward fix.

This restores desired state and keeps Git authoritative.

### 29.3 Argo history rollback is an emergency tool

Argo CD cannot roll back an Application while automated sync is enabled.

If an approved emergency requires history rollback:

1. record current Git and Argo revisions;
2. temporarily disable automated sync;
3. select a verified healthy history ID;
4. perform the rollback;
5. verify application health;
6. immediately revert/reconcile Git to that desired state;
7. re-enable the approved sync policy;
8. confirm no remaining drift.

If Git is not reconciled, the next automated reconciliation can restore the bad
revision.

### 29.4 `kubectl rollout undo`

Do not use it for normal GitOps rollback. In a life-safety or severe-outage
emergency:

- obtain incident authority;
- capture current resources;
- pause self-heal if necessary;
- roll back only the exact Deployment;
- validate;
- make Git match immediately;
- resume reconciliation.

An undocumented live-only change is not a completed rollback.

### 29.5 Database-change policy

Future schema/data changes must use backward-compatible expand/contract
sequencing:

1. deploy code compatible with old and new representations;
2. add/migrate data;
3. verify;
4. switch reads/writes;
5. remove old representation in a later release.

Never assume an application image rollback can reverse a destructive data
migration. Take and verify a backup before risky changes.

### 29.6 Secret rollback

If a credential rotation fails:

1. preserve both old and new versions during the overlap;
2. restore the last known-good Secrets Manager version label;
3. wait for External Secrets;
4. restart only affected Pods if required;
5. test readiness and CRUD;
6. revoke neither credential until stability is confirmed;
7. investigate and repeat rotation safely.

### 29.7 Platform recovery inventory

Maintain tested recovery procedures for:

- GitHub application and GitOps repositories;
- Jenkins configuration, plugins, credentials metadata, and job history;
- SonarQube database;
- Argo declarative resources and repository credentials;
- Prometheus/Grafana persistent data and dashboard definitions;
- Loki object storage/configuration;
- database backups;
- Terraform/OpenTofu state and locks;
- DNS, ACM, WAF, and load-balancer IaC.

Measure recovery time against the approved RTO and data loss against RPO.

### 29.8 Scaling rollback

If an HPA/load test causes instability:

1. stop the test source;
2. inspect HPA events and current metrics;
3. return bounds to the last reviewed Git values;
4. do not hand-edit replicas while Git/HPA continues fighting the value;
5. verify resource pressure and target health;
6. record the sustainable concurrency and resource profile.

---

## 30. Troubleshooting matrix

Start with the first failed boundary. Do not change multiple layers at once.

| Symptom | Likely boundary | First checks | Corrective direction |
|---|---|---|---|
| Jenkins branch never appears | GitHub → Jenkins discovery | GitHub webhook delivery, multibranch scan log, credentials | Fix webhook/auth/repository discovery |
| Jenkins agent offline | Controller → agent SSH | node log, port 22 SG, SSH host key, Java | Restore verified SSH/remoting; do not use non-verifying strategy in production |
| Build ran on controller | Jenkins label | build node name, job agent expression, controller executors | exact dedicated label; controller executors `0` |
| `npm ci` fails | source/dependency | Node/npm version, lockfile, registry, disk | align Node 24 and lockfile; do not delete lockfile casually |
| Backend tests cannot start Mongo memory server | agent runtime/network | binary cache, outbound download, bind permission, libraries | pin/cache `MONGOMS_VERSION` or use an ephemeral test Mongo service |
| Lint passes instantly with a message | repository script | `package.json` lint script | install/configure ESLint and fail warnings |
| Jenkins Test Result missing | report production | XML path, reporter config, Jenkins `junit` step | generate JUnit and reject missing results |
| Sonar coverage `0%` | coverage import | LCOV path, exclusions, analyzed source | fix test coverage before changing Sonar exclusions |
| Quality Gate waits forever | Sonar → Jenkins webhook | Sonar webhook delivery and trailing slash | set `<JENKINS_URL>/sonarqube-webhook/` |
| Trivy “passes” but no artifact | scan/report | console command and reports directory | generate JSON/SBOM first, then enforcement scan |
| Docker build cannot find `package.json` | build context | Dockerfile/context pair | use `backend` or `frontend` context |
| Image includes local files | Docker context | tracked `.dockerignore`, `docker history`, context list | commit ignore files and rebuild |
| ECR push denied | agent IAM/ECR | caller identity, repository, region, IAM denial | least-privilege push actions for exact repository |
| Immutable tag push fails | release tag policy | tag already exists | generate unique tag; never overwrite `latest` |
| GitOps token appears in `.git/config` | credential handling | remote URL and workspace | rotate token; use binding/App/deploy key; clean workspace |
| GitOps push rejected | concurrent writers | remote commits, lock/rebase logs | serialize or retry/rebase; split service value files |
| Argo `ComparisonError` | Git/chart render | repo auth, path, values file, `helm template` | repair declarative source; do not force sync |
| Argo remains `OutOfSync` | live mutation/defaulting | Argo diff and owning controller | fix ownership/default; narrow ignore rules |
| StatefulSet rejected | raw Mongo manifest | API validation | add required `spec.serviceName` and headless Service |
| PVC pending | storage | PVC events, StorageClass, CSI controller | correct class/topology/capacity |
| `ImagePullBackOff` | registry/pod identity | Pod events, digest existence, pull Secret/node IAM | fix exact repository/digest and pull auth |
| Backend readiness `503` | application → database | backend JSON logs, Mongo endpoint, Secret sync, policy | restore DB reachability/credential; avoid liveness restart loop |
| Frontend returns `502` | Nginx → backend | frontend error log, Service endpoints, DNS, NetworkPolicy | restore `backend-svc:5000` path |
| Ingress `/api` times out | ingress topology/policy | Ingress backend, Nginx proxy, policy tests | route only to frontend or permit actual ingress path consistently |
| ALB target unhealthy | ALB → frontend | target reason, `/healthz`, SG, target type, Pod readiness | fix health path/port/data path |
| CORS fails in browser | origin architecture | browser Network/Console, response header | prefer same-origin; otherwise exact approved origin |
| Prometheus target down | monitoring → backend | Target Last Error, ServiceMonitor selector/port, endpoints, policy | name port `http`, align labels, allow scrape |
| Error alert is noisy | PromQL/traffic | query numerator/denominator and volume | use ratio plus minimum traffic and `for` |
| Logs absent in Loki | app → Alloy → Loki | stdout, Alloy discovery/logs, gateway readiness, time range | repair first broken hop |
| Loki queries slow/high memory | label/query/storage | stream cardinality, broad selectors, time range | reduce labels, narrow queries, size/retain correctly |
| ZAP report missing | Jenkins → scanner | Docker exit code, mount ownership, target reachability | treat as scanner failure; remove unconditional success suppression |
| ZAP scans old release | CD sequencing | report time/target, Argo revision, expected digest | wait for exact revision before scan |
| Alert email absent | Alertmanager → SMTP | route match, receiver, Secret, TLS, mail logs | fix selector/route/TLS; do not expose password |

### 30.1 Jenkins diagnostics

Controller:

```bash
sudo systemctl status jenkins --no-pager
sudo journalctl -u jenkins --since=-30m --no-pager
```

UI:

- **Manage Jenkins** → **System Log**;
- **Manage Jenkins** → **Nodes** → agent → **Log**;
- job → branch → build → **Console Output**;
- multibranch root → **Scan Multibranch Pipeline Log**.

Check disk before cleanup:

```bash
df -h
df -i
docker system df -v
du -x -h -d 1 /var/lib/jenkins 2>/dev/null | sort -h
```

Do not make `docker system prune -af` the default remedy on a shared agent.

### 30.2 Kubernetes diagnostics

```bash
kubectl config current-context
kubectl -n <APP_NAMESPACE> get pods -o wide
kubectl -n <APP_NAMESPACE> get events \
  --sort-by=.metadata.creationTimestamp
kubectl -n <APP_NAMESPACE> describe pod <POD_NAME>
kubectl -n <APP_NAMESPACE> logs <POD_NAME> \
  --all-containers --tail=200
kubectl -n <APP_NAMESPACE> logs <POD_NAME> \
  --all-containers --previous --tail=200
kubectl -n <APP_NAMESPACE> get endpointslices
```

Do not print `env` from a production Pod when it contains Secrets.

### 30.3 DNS and service diagnostics

Use a pinned diagnostic image:

```bash
kubectl -n <APP_NAMESPACE> run net-debug \
  --image=nicolaka/netshoot:<PINNED_TAG> \
  --restart=Never \
  --command -- sleep 900

kubectl -n <APP_NAMESPACE> exec net-debug -- \
  getent hosts backend-svc

kubectl -n <APP_NAMESPACE> exec net-debug -- \
  curl --fail --max-time 5 http://backend-svc:5000/health
```

Apply the source labels needed for a policy test. Delete the debug Pod after the
session. Do not permanently add shells and network tools to production images.

### 30.4 AWS diagnostics

```bash
aws sts get-caller-identity
aws eks describe-cluster \
  --name <CLUSTER_NAME> \
  --region <AWS_REGION>
aws ecr describe-images \
  --repository-name <REPOSITORY> \
  --region <AWS_REGION>
```

Console:

- CloudTrail Event history for authorization failures;
- EKS add-on health and control-plane logs;
- EC2 target-group health reason;
- VPC Flow Logs for rejects;
- Secrets Manager resource policy;
- IAM Access Analyzer;
- CloudWatch alarms/log groups.

Do not respond to an authorization error by attaching `AdministratorAccess`.
Find the denied action/resource and adjust the narrow policy.

### 30.5 Configuration-change discipline

For every fix:

1. state the failed boundary and evidence;
2. change one authoritative source;
3. validate locally/rendered;
4. merge through Git;
5. wait for reconciliation;
6. rerun the failed check;
7. remove temporary debug access/resources;
8. update the incident or implementation record.

---

## 31. Teardown and cost control

Teardown is destructive. Confirm account, region, context, namespace, backups,
and retention requirements before running any command.

### 31.1 Stop versus delete the lab

Stop preserves the Minikube profile:

```bash
minikube stop --profile crud-lab
```

Delete removes the profile and its local cluster data:

```bash
minikube delete --profile crud-lab
```

Before delete:

- export any required test evidence;
- verify MongoDB lab data is disposable or backed up;
- archive only non-sensitive reports;
- record final resource state.

If EC2 is retained, review:

```bash
docker system df -v
df -h
```

Remove only known, expired build artifacts/images or replace the disposable
agent. Broad cleanup can affect concurrent builds.

### 31.2 Production teardown order

Use the same reviewed IaC tool that created the platform. A safe dependency
order is:

1. freeze deployments and record final state;
2. take/verify required database, object-storage, Jenkins, and IaC-state
   backups;
3. remove application DNS traffic;
4. delete Argo Applications according to the approved data-retention policy;
5. wait for Kubernetes-managed ALBs, target groups, and security groups to be
   deleted;
6. remove External Secrets/application resources;
7. retain or explicitly expire ECR images and scan evidence;
8. remove node autoscalers and node groups;
9. delete the EKS cluster;
10. delete remaining VPC endpoints, NAT gateways, Elastic IPs, and VPC
    resources;
11. delete managed database only after final snapshot verification;
12. expire S3/Loki/ALB log data according to retention policy;
13. remove obsolete IAM roles, Pod Identity/IRSA associations, KMS grants, and
    Secrets Manager values;
14. verify no orphan resources or recurring charges.

Do not delete the cluster before controllers have removed cloud load balancers;
otherwise ALBs, target groups, and security groups can be orphaned.

### 31.3 AWS Console final cost check

Inspect:

- **EC2**: instances, EBS volumes/snapshots, Elastic IPs, load balancers, target
  groups;
- **EKS**: clusters and node groups;
- **VPC**: NAT gateways and interface endpoints;
- **ECR**: retained images;
- **S3**: Loki, ALB, flow-log, and backup buckets;
- **DocumentDB/managed database**: clusters, instances, snapshots;
- **Secrets Manager**: scheduled deletion and recovery window;
- **CloudWatch**: log groups and retention;
- **KMS**: keys and pending deletion;
- **Route 53**: hosted zones and records;
- **Certificate Manager/WAF**: unused resources;
- **Cost Explorer** and **Budgets**: unexpected daily cost after teardown.

Tag every resource so cost and teardown ownership can be proven.

### 31.4 Routine cost controls

- lifecycle unreferenced CI images;
- right-size Jenkins/Sonar agents and stop lab hosts outside teaching windows;
- use ephemeral agents;
- set log/metric retention deliberately;
- avoid unreviewed high-cardinality metrics/log labels;
- review NAT and cross-AZ data transfer;
- schedule non-production node groups where acceptable;
- set AWS Budgets alerts before platform creation;
- review idle load balancers, volumes, snapshots, and public IPv4 charges.

---

## 32. Definition of done

### 32.1 Repository

- [ ] Both `.dockerignore` files are tracked and exclude secrets/build noise.
- [ ] Node 24 LTS is tested and used consistently.
- [ ] Real ESLint runs in both services.
- [ ] Backend and frontend produce JUnit and LCOV.
- [ ] Frontend uses one same-origin `/api` contract.
- [ ] Compose builds current source and resolves `backend-svc`.
- [ ] Nginx has `/healthz`, JSON logs, request IDs, and tested headers.
- [ ] Backend has `/live` and `/ready`, bounded validation/search/pagination, and
      normalized metric labels.
- [ ] Authentication, authorization, abuse controls, and threat model are
      approved for the intended data.
- [ ] Raw Kubernetes StatefulSet, Services, Ingress, policy, security context,
      probes, resources, and script paths are corrected.

### 32.2 Jenkins and CI

- [ ] Controller has zero build executors.
- [ ] Both multibranch jobs use the exact dedicated agent label.
- [ ] Credential IDs match this guide.
- [ ] PR builds cannot access registry/GitOps/deployment credentials.
- [ ] Tool versions are pinned/verified.
- [ ] Sonar webhook and blocking Quality Gates work.
- [ ] Trivy creates reports and enforces policy.
- [ ] Build creates unique tags, records digest, and optionally creates reviewed
      SBOM/signature/provenance controls.
- [ ] No token is embedded in a Git URL.
- [ ] Frontend/backend GitOps writes cannot race.
- [ ] Jenkins waits for exact Argo revision/digest.
- [ ] ZAP has explicit policy and no `|| true`.
- [ ] Reports/tests are visible in Jenkins.
- [ ] Cleanup is targeted, not global prune.

### 32.3 GitOps and Kubernetes

- [ ] Separate GitOps repository/chart exists and validates.
- [ ] Production values deploy images by digest.
- [ ] Plaintext Secrets are absent from Git.
- [ ] Argo AppProject limits repositories/destinations/resources.
- [ ] Staging/production sync and promotion policy is documented.
- [ ] Services are ClusterIP except intentional load-balancer entry.
- [ ] Only frontend is public; `/metrics` is internal.
- [ ] Numeric non-root, seccomp, dropped capabilities, read-only roots, and
      token-mount policy are tested.
- [ ] Resources, HPA, PDB, topology, and rollout strategy are tested.
- [ ] NetworkPolicy tests prove allowed and denied paths.
- [ ] MongoDB StatefulSet is lab-only; production database is managed and
      compatibility tested.

### 32.4 AWS production

- [ ] VPC/EKS are managed by reviewed IaC.
- [ ] Supported EKS version and compatible add-ons are active.
- [ ] Nodes and workload replicas span zones.
- [ ] EBS CSI and encrypted gp3 storage are tested.
- [ ] AWS Load Balancer Controller uses workload identity.
- [ ] ALB HTTPS, ACM, DNS, target health, WAF, and logs are verified.
- [ ] ECR IAM is least privilege and tags are immutable.
- [ ] External Secrets uses workload identity and a narrow secret ARN.
- [ ] Database TLS, network, backups, restore, RPO, and RTO are tested.
- [ ] Control-plane, CloudTrail, flow, and application logs meet retention
      policy.

### 32.5 Observability and operations

- [ ] Prometheus backend target is `UP`.
- [ ] Metric names/labels match current code.
- [ ] Error alert is a ratio and has traffic/noise controls.
- [ ] Alertmanager selectors and SecretKeySelector are valid.
- [ ] Promtail is absent; Alloy is healthy.
- [ ] Loki has explicit schema/storage/retention/resources.
- [ ] Production Loki uses external object storage and workload identity.
- [ ] Request ID correlates frontend/backend logs without becoming a label.
- [ ] Grafana dashboards/datasources are provisioned and reviewed.
- [ ] Alert delivery and resolution are tested.
- [ ] Promotion, Git-revert rollback, secret rotation, backup restore, scaling,
      and teardown drills have evidence.

### 32.6 Release evidence

- [ ] Source commit, two image digests, GitOps commit, Argo revision, and live
      Pod images all match.
- [ ] Unit/lint/build, Sonar, Trivy, smoke, and ZAP gates passed.
- [ ] A disposable CRUD transaction passed and cleaned up.
- [ ] Metrics and logs show the acceptance request.
- [ ] No secret or sensitive payload appears in logs, reports, email, or Git.
- [ ] A known-good rollback revision is recorded.

---

## 33. Official references and maintenance

Use primary documentation and re-check versions before implementation:

- Node.js release status:
  <https://nodejs.org/en/about/previous-releases>
- Jenkins Linux installation:
  <https://www.jenkins.io/doc/book/installing/linux/>
- Jenkins Pipeline and credentials:
  <https://www.jenkins.io/doc/book/pipeline/jenkinsfile/>
- Jenkins Multibranch Pipeline:
  <https://www.jenkins.io/doc/book/pipeline/multibranch/>
- Kubernetes version skew:
  <https://kubernetes.io/releases/version-skew-policy/>
- SonarQube Jenkins Quality Gate webhook:
  <https://docs.sonarsource.com/sonarqube-server/2025.5/analyzing-source-code/ci-integration/jenkins-integration/pipeline-pause>
- Argo CD automated sync:
  <https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/>
- Argo CD Helm behavior:
  <https://argo-cd.readthedocs.io/en/stable/user-guide/helm/>
- Grafana Promtail lifecycle:
  <https://grafana.com/docs/loki/latest/send-data/promtail/>
- Loki community Helm monolithic installation:
  <https://grafana.com/docs/loki/latest/setup/install/helm/install-monolithic/>
- Grafana Alloy Kubernetes installation:
  <https://grafana.com/docs/alloy/latest/set-up/install/kubernetes/>
- AWS EKS Load Balancer Controller:
  <https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html>
- AWS EKS ALB Ingress:
  <https://docs.aws.amazon.com/eks/latest/userguide/alb-ingress.html>
- Amazon DocumentDB functional differences:
  <https://docs.aws.amazon.com/documentdb/latest/devguide/functional-differences.html>
- ZAP baseline packaged scan:
  <https://www.zaproxy.org/docs/docker/baseline-scan/>
- Prometheus Operator API:
  <https://prometheus-operator.dev/docs/api-reference/api/>
- GitHub webhook deliveries:
  <https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/viewing-webhook-deliveries>

### 33.1 Maintenance rule

Review this guide:

- before each platform/tool major upgrade;
- at least quarterly;
- after an incident or rollback;
- when application routes, ports, logs, metrics, credential IDs, repository
  layout, or deployment ownership changes.

For each review:

1. verify official lifecycle/version pages;
2. run repository tests and render/scan manifests;
3. compare Jenkinsfiles with credential and stage contracts;
4. compare GitOps values with live Argo state;
5. test one UI verification path per platform;
6. update revision date and an auditable change record.

This guide is complete only when its **Required correction** items have been
implemented and the definition-of-done evidence exists. It deliberately does
not label planned controls as already enabled.
