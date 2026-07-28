{{/*
Chart name / fullname / labels — the usual helpers, kept minimal.
*/}}
{{- define "developer-portal.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "developer-portal.fullname" -}}
{{- default .Chart.Name .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "developer-portal.labels" -}}
app.kubernetes.io/name: {{ include "developer-portal.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: platform
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "developer-portal.selectorLabels" -}}
app.kubernetes.io/name: {{ include "developer-portal.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
developer-portal.image — the container reference, digest-pinned.

THE REFUSALS ARE THE POINT. Defect D7 on this platform was a mutable image
reference that ran the wrong repository's code: the manifest was well-formed,
the deployment was healthy, and the running code was somebody else's. A values
comment cannot prevent that; a render that fails can.

  * `image.tag` set at all      -> refuse. There is no legitimate use here, and
                                   accepting it silently would reintroduce D7.
  * digest missing or malformed -> refuse. An empty digest would otherwise
                                   render `repo@`, which fails later and further
                                   from the cause.
*/}}
{{- define "developer-portal.image" -}}
{{- if .Values.image.tag -}}
{{- fail "image.tag is refused: this chart pins by digest only (defect D7 — a mutable reference ran the wrong repository's code). Set image.digest to the sha256 the release workflow published." -}}
{{- end -}}
{{- $digest := .Values.image.digest | default "" -}}
{{- if not (regexMatch "^sha256:[a-f0-9]{64}$" $digest) -}}
{{- fail (printf "image.digest must be sha256:<64 hex chars>, got %q. The release workflow prints it in the run summary." $digest) -}}
{{- end -}}
{{- printf "%s@%s" .Values.image.repository $digest -}}
{{- end -}}
