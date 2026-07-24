# Kubernetes Resources in `k8s/`

This README explains each Kubernetes manifest in this folder and how to verify that the resources and network policies are working.

## What is included

- `apply-all.sh` - applies the manifests in the correct order
- `ingress.yaml` - exposes frontend and backend through NGINX Ingress
- `backend/be-config.yaml` - backend environment configuration
- `backend/be-deployement.yaml` - backend Deployment
- `backend/be-svc.yaml` - backend Service
- `frontend/fe-deployement.yaml` - frontend Deployment
- `frontend/fe-svc.yaml` - frontend Service
- `db/db-pvc.yaml` - persistent volume claim for MongoDB
- `db/db-deployment.yaml` - MongoDB StatefulSet
- `db/db-svc.yaml` - MongoDB Service
- `network/policy.yaml` - NetworkPolicy rules for traffic restrictions

---

## Resource explanations

### `db/db-pvc.yaml`
- Defines a `PersistentVolumeClaim` named `mongo-data-pvc`.
- Requests `1Gi` of storage.
- Used by MongoDB to persist database files under `/data/db`.

### `db/db-deployment.yaml`
- Creates a `StatefulSet` named `mongodb`.
- Runs the official `mongo:7` image.
- Uses the `mongo-data-pvc` volume to persist data.
- Exposes port `27017` inside the pod.
- Includes readiness and liveness checks using `mongosh` ping.

### `db/db-svc.yaml`
- Creates a `ClusterIP` service named `mongodb-svc`.
- Selects pods with label `app: mongodb`.
- Exposes port `27017` to other cluster services.

### `backend/be-config.yaml`
- A `ConfigMap` named `backend-config`.
- Stores backend environment variables:
  - `PORT=5000`
  - `MONGO_URI=mongodb://mongodb-svc:27017/three-tier-crud`
  - `NODE_ENV=production`
  - `CORS_ORIGIN=http://localhost:3000`
- Used by the backend Deployment to configure the application.

### `backend/be-deployement.yaml`
- Creates the backend `Deployment` with one replica.
- Runs the image `rohankhanal14/k8s-day-24-backend:k8s-backend`.
- Mounts environment variables from `backend-config`.
- Exposes port `5000`.
- Includes health probes at `/health`.

### `backend/be-svc.yaml`
- Creates a `NodePort` service named `backend-svc`.
- Selects pods labeled `app: backend`.
- Exposes port `5000` and allocates node port `30050`.
- Used by frontend and ingress to reach the backend.

### `frontend/fe-deployement.yaml`
- Creates a frontend `Deployment` with two replicas.
- Runs the image `rohankhanal14/k8s-day-24:k8s-f`.
- Exposes container port `8080`.
- Includes readiness and liveness probes on `/`.

### `frontend/fe-svc.yaml`
- Creates a `NodePort` service named `frontend-svc`.
- Selects pods labeled `app: frontend`.
- Exposes port `80` and maps to container port `8080`.
- Node port is `30030`.

### `ingress.yaml`
- Creates an `Ingress` resource named `three-tier-crud-app-ingress`.
- Uses `spec.ingressClassName: nginx` to target the NGINX ingress controller.
- Routes:
  - `/api` → `backend-svc:5000`
  - `/health` → `backend-svc:5000`
  - `/metrics` → `backend-svc:5000`
  - `/` → `frontend-svc:80`
- Uses host `myapp.local`.

### `network/policy.yaml`
Contains five NetworkPolicy rules:

1. `default-deny-all`
   - Denies all ingress and egress traffic for pods in the namespace unless explicitly allowed.

2. `allow-dns-egress`
   - Allows all pods to use DNS over UDP/TCP port `53`.
   - Required so pods can resolve service names.

3. `mongodb-allow-from-backend`
   - Only allows pods with `app: backend` to connect to `mongodb` pods on port `27017`.

4. `backend-allow-from-frontend`
   - Only allows pods with `app: frontend` to connect to the backend on port `5000`.
   - Also allows the backend to egress to MongoDB on port `27017`.

5. `frontend-allow-from-ingress`
   - Only allows traffic to frontend pods on port `8080` from pods in the namespace labeled `kubernetes.io/metadata.name=ingress-nginx`.
   - Allows frontend pods to egress to backend on port `5000`.

> Note: NetworkPolicy only works if the cluster CNI supports it. Minikube’s default CNI does not enforce policies by default. Use `--cni=calico` or another policy-enabled CNI.

---

## Deployment steps

1. Start Minikube with ingress and a policy-capable CNI if you want NetworkPolicy enforcement:

```bash
minikube delete
minikube start --cni=calico
minikube addons enable ingress
```

2. Apply the manifests from the `k8s` folder:

```bash
cd /home/rohan/Desktop/three-tier-crud-app/k8s
./apply-all.sh
kubectl apply -f network/policy.yaml
```

3. Check that the pods are running:

```bash
kubectl get pods
kubectl get svc
kubectl get ingress
```

---

## How to access the app

### If using `myapp.local`

Add the host mapping to your computer:

```bash
echo "$(minikube ip) myapp.local" | sudo tee -a /etc/hosts
```

Then open these URLs in your browser:

- `http://myapp.local/`
- `http://myapp.local/api/items`
- `http://myapp.local/health`

### If you want to skip the host name

Use the Minikube IP and host header manually:

```bash
minikube ip
curl -H 'Host: myapp.local' http://$(minikube ip)/
```

---

## How to verify each component

### 1. Verify database

```bash
kubectl get pvc mongo-data-pvc
kubectl get statefulset mongodb
kubectl get svc mongodb-svc
```

If the PVC is `Bound` and the MongoDB pod is `Running`, the database is healthy.

### 2. Verify backend

```bash
kubectl get deployment backend
kubectl get svc backend-svc
kubectl get pods -l app=backend
```

Then test the backend directly from inside the cluster:

```bash
kubectl run --rm -it backend-test --image=curlimages/curl --restart=Never -- /bin/sh
curl -I http://backend-svc:5000/health
```

Expected response: `200 OK`.

### 3. Verify frontend

```bash
kubectl get deployment frontend
kubectl get svc frontend-svc
kubectl get pods -l app=frontend
```

Then test frontend directly from inside the cluster:

```bash
kubectl run --rm -it frontend-test --image=curlimages/curl --restart=Never -- /bin/sh
curl -I http://frontend-svc:8080/
```

Expected response: `200 OK`.

### 4. Verify ingress

Check the ingress resource:

```bash
kubectl get ingress three-tier-crud-app-ingress
kubectl describe ingress three-tier-crud-app-ingress
```

From your machine, if `myapp.local` is configured:

```bash
curl -I http://myapp.local/
curl -I http://myapp.local/api/items
curl -I http://myapp.local/health
```

If the host is not resolving, use the Minikube IP with the host header:

```bash
curl -I -H 'Host: myapp.local' http://$(minikube ip)/
```

---

## How to verify NetworkPolicy rules

> Important: NetworkPolicy must be enforced by the CNI. In Minikube, use `calico` or another policy-capable network plugin.

### Confirm the policy engine is running

```bash
kubectl get pods -n kube-system | grep calico
kubectl get networkpolicy
kubectl describe networkpolicy frontend-allow-from-ingress
```

### Test DNS access

The policy set allows DNS for all pods. Run:

```bash
kubectl run --rm -it dns-test --image=curlimages/curl --restart=Never -- /bin/sh
nslookup kubernetes.default
```

If DNS resolution works, egress DNS is allowed.

### Test frontend access from ingress controller

This validates `frontend-allow-from-ingress`.

1. Create a temporary pod in the ingress namespace:

```bash
kubectl run --rm -it test-ingress --image=curlimages/curl --restart=Never -n ingress-nginx -- /bin/sh
```

2. Inside the pod, run:

```sh
curl -I http://frontend-svc:8080/
```

Expected: `200 OK`.

3. From a pod in another namespace, try the same endpoint:

```bash
kubectl run --rm -it deny-frontend --image=curlimages/curl --restart=Never -- /bin/sh
curl -I http://frontend-svc:8080/
```

Expected: connection failure or timeout.

### Test backend access from frontend only

This validates `backend-allow-from-frontend`.

1. From a frontend pod:

```bash
kubectl exec -it $(kubectl get pod -l app=frontend -o jsonpath='{.items[0].metadata.name}') -- /bin/sh
curl -I http://backend-svc:5000/health
```

Expected: `200 OK`.

2. From a pod not labeled `app=frontend`:

```bash
kubectl run --rm -it deny-backend --image=curlimages/curl --restart=Never -- /bin/sh
curl -I http://backend-svc:5000/health
```

Expected: connection failure.

### Test MongoDB access from backend only

This validates `mongodb-allow-from-backend`.

1. From a backend pod:

```bash
kubectl exec -it $(kubectl get pod -l app=backend -o jsonpath='{.items[0].metadata.name}') -- /bin/sh
nc -zv mongodb-svc 27017
```

Expected: success.

2. From a frontend pod:

```bash
kubectl exec -it $(kubectl get pod -l app=frontend -o jsonpath='{.items[0].metadata.name}') -- /bin/sh
nc -zv mongodb-svc 27017
```

Expected: failure.

### Verify network policy results

If network policy is working correctly:

- `frontend` accepts traffic only from `ingress-nginx` namespace on port `8080`.
- `backend` accepts traffic only from `frontend` pods on port `5000`.
- `mongodb` accepts traffic only from `backend` pods on port `27017`.
- DNS still resolves.

If any test succeeds where it should fail, the CNI is not enforcing policies or labels/selectors are mismatched.

---

## Troubleshooting

- If `myapp.local` does not resolve:
  - confirm `minikube ip` is correct
  - confirm `/etc/hosts` contains the mapping

- If ingress returns `404` or incorrect service:
  - verify `kubectl describe ingress three-tier-crud-app-ingress`
  - verify the service names and ports match `backend-svc` and `frontend-svc`

- If network policy tests do not block traffic:
  - ensure Minikube is started with `--cni=calico`
  - check `kubectl get pods -n kube-system | grep calico`
  - make sure the namespace label on `ingress-nginx` is present

---

## Useful commands

```bash
kubectl get all
kubectl get svc
kubectl get ingress
kubectl get networkpolicy
kubectl describe pod <pod-name>
kubectl describe ingress three-tier-crud-app-ingress
kubectl logs -n ingress-nginx <ingress-controller-pod>
```