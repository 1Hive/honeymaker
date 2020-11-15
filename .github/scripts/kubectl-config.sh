#!/bin/sh
set -e # exit on error
KUBE_CA="$1"
KUBE_SERVER="$2"
KUBE_TOKEN="$3"
# config cluster access
echo $KUBE_CA | base64 -d > ca.crt
kubectl config set-cluster 1hive --server=$KUBE_SERVER --certificate-authority=ca.crt
kubectl config set-credentials 1hive --token=$(echo $KUBE_TOKEN | base64 -d)
kubectl config set-context 1hive --cluster=1hive --user=1hive
kubectl config use-context 1hive