import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native';
import SafeScreen from '../components/SafeScreen';
import { checkUpdates, applyOtaUpdate, downloadAndInstallApk, UpdateCheckResult } from '../services/updateService';
import { salvarUltimoCheckUpdate } from '../services/storageService';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { FontAwesome } from '@expo/vector-icons';
import { logDebug } from '../utils/filiadoUtils';
import { getErrorMessage } from '../infra/errorUtils';

const AtualizacoesScreen = () => {
    const [isChecking, setIsChecking] = useState(false);
    const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
    const [lastCheck, setLastCheck] = useState<Date | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    const manifest = updateResult?.manifest;
    const isOTAIncompatible = updateResult?.type === 'APK' && manifest?.runtimeVersion !== Updates.runtimeVersion;

    const versionCode = Application.nativeBuildVersion;
    const versionName = Application.nativeApplicationVersion;
    const runtimeVersion = Updates.runtimeVersion;
    const channel = Updates.channel;
    const updateUrl = (Constants.expoConfig as any)?.updates?.url;

    const handleCheck = async () => {
        setIsChecking(true);
        setUpdateResult(null);
        setStatusMessage('Verificando...');
        try {
            const result = await checkUpdates();
            setUpdateResult(result);
            setLastCheck(new Date());

            // Atualiza o timestamp do último check para silenciar o auto-check global
            if (result) {
                await salvarUltimoCheckUpdate();
            }

            if (result?.error) {
                setStatusMessage(result.error);
            } else if (result?.hasUpdate) {
                setStatusMessage(result.type === 'OTA' ? 'OTA disponível' : 'APK disponível');
            } else if (result) {
                setStatusMessage('Manifest lido com sucesso (OTA não disponível)');
            } else {
                setStatusMessage('Não foi possível verificar');
            }
        } catch (error: unknown) {
            logDebug('Atualizacoes.check.error', error);
            setStatusMessage('Erro ao verificar');
            Alert.alert('Erro', 'Falha ao verificar atualizações: ' + getErrorMessage(error, 'Erro desconhecido'));
        } finally {
            setIsChecking(false);
        }
    };

    const handleApplyOTA = () => {
        Alert.alert(
            'Confirmar Atualização',
            'O aplicativo será reiniciado para aplicar as mudanças. Deseja continuar?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Atualizar',
                    onPress: async () => {
                        setIsApplying(true);
                        try {
                            await applyOtaUpdate();
                        } catch (error: unknown) {
                            Alert.alert('Erro', 'Falha ao aplicar atualização: ' + getErrorMessage(error, 'Erro desconhecido'));
                            setIsApplying(false);
                        }
                    }
                }
            ]
        );
    };

    const handleDownloadAPK = async () => {
        if (updateResult?.apkFileId && updateResult?.apkFileName) {
            setIsApplying(true);
            try {
                await downloadAndInstallApk(updateResult.apkFileId, updateResult.apkFileName);
            } catch (error: unknown) {
                Alert.alert('Erro no Download', getErrorMessage(error, 'Erro desconhecido'));
            } finally {
                setIsApplying(false);
            }
        } else {
            Alert.alert('Erro', 'Não foi possível localizar o APK no Drive. Verifique a pasta App.');
        }
    };

    return (
        <SafeScreen style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Informações do App</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Versão (Name):</Text>
                        <Text style={styles.infoValue}>{versionName}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Build (versionCode):</Text>
                        <Text style={styles.infoValue}>{versionCode}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Runtime Version:</Text>
                        <Text style={styles.infoValue}>{runtimeVersion || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Canal (EAS):</Text>
                        <Text style={styles.infoValue}>{channel || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Update URL:</Text>
                        <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">{updateUrl || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Update ID:</Text>
                        <Text style={styles.infoValue}>{Updates.updateId || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Embedded Launch:</Text>
                        <Text style={styles.infoValue}>{Updates.isEmbeddedLaunch ? 'Sim' : 'Não'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Created At:</Text>
                        <Text style={styles.infoValue}>
                            {(Updates as any).createdAt ? new Date((Updates as any).createdAt).toLocaleString('pt-BR') : 'N/A'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.checkButton}
                    onPress={handleCheck}
                    disabled={isChecking || isApplying}
                >
                    {isChecking ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <View style={styles.checkButtonInner}>
                            <FontAwesome name="refresh" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.checkButtonText}>Verificar Atualizações</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {lastCheck && (
                    <View style={styles.statusContainer}>
                        <Text style={styles.lastCheckText}>
                            Última verificação: {lastCheck.toLocaleTimeString()}
                        </Text>
                        {statusMessage ? (
                            <Text style={styles.statusMessage}>{statusMessage}</Text>
                        ) : null}
                    </View>
                )}

                {updateResult && updateResult.hasUpdate && !updateResult.error ? (
                    <View style={[styles.resultCard, updateResult.isMandatory ? styles.mandatoryCard : styles.optionalCard]}>
                        <View style={styles.resultHeader}>
                            <FontAwesome
                                name={updateResult.type === 'OTA' ? 'cloud-download' : 'android'}
                                size={24}
                                color={updateResult.isMandatory ? '#d32f2f' : '#2e7d32'}
                            />
                            <Text style={styles.resultTitle}>
                                Atualização {updateResult.type} Disponível!
                            </Text>
                        </View>

                        <Text style={styles.resultVersion}>Nova versão: {manifest?.versionName || 'N/A'}</Text>
                        {updateResult.type === 'APK' && (
                            <View style={styles.apkInfoBox}>
                                <Text style={styles.apkInfoText}>ABI detectada: {updateResult.apkAbi}</Text>
                                <Text style={styles.apkInfoText} numberOfLines={1}>Arquivo: {updateResult.apkFileName}</Text>
                            </View>
                        )}
                        <Text style={styles.resultNotesTitle}>O que mudou:</Text>
                        <Text style={styles.resultNotes}>
                            {updateResult.type === 'OTA' ? (manifest?.ota?.notes || '') : (manifest?.apk?.notes || '')}
                        </Text>

                        {updateResult.isMandatory && (
                            <View style={styles.mandatoryBadge}>
                                <FontAwesome name="exclamation-triangle" size={14} color="#d32f2f" />
                                <Text style={styles.mandatoryWarning}>Esta atualização é obrigatória.</Text>
                            </View>
                        )}

                        {isOTAIncompatible && (
                            <View style={styles.incompatibleBox}>
                                <FontAwesome name="info-circle" size={16} color="#003366" />
                                <Text style={styles.incompatibleText}>
                                    OTA não disponível por compatibilidade de sistema. É necessário instalar o novo APK para continuar recebendo atualizações.
                                </Text>
                            </View>
                        )}

                        {updateResult.type === 'APK' && (
                            <View style={styles.apkGuideBox}>
                                <Text style={styles.apkGuideTitle}>Instruções de Instalação:</Text>
                                <Text style={styles.apkGuideText}>1. Clique em "Baixar e Instalar APK" abaixo.</Text>
                                <Text style={styles.apkGuideText}>2. Se solicitado, autorize a instalação de "Fontes Desconhecidas" para este aplicativo.</Text>
                                <Text style={styles.apkGuideText}>3. O instalador do Android abrirá automaticamente.</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: updateResult.isMandatory ? '#d32f2f' : '#003366' }, isApplying && { opacity: 0.7 }]}
                            onPress={updateResult.type === 'OTA' ? handleApplyOTA : handleDownloadAPK}
                            disabled={isApplying}
                        >
                            {isApplying ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
                                    <Text style={styles.actionButtonText}>
                                        {updateResult.type === 'OTA' ? 'Aplicando...' : 'Baixando APK...'}
                                    </Text>
                                </View>
                            ) : (
                                <Text style={styles.actionButtonText}>
                                    {updateResult.type === 'OTA' ? 'Baixar e Aplicar (Reiniciar)' : 'Baixar e Instalar APK'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : lastCheck && !updateResult?.error ? (
                    <View style={styles.noUpdateCard}>
                        <FontAwesome name="check-circle" size={40} color="#2e7d32" />
                        <Text style={styles.noUpdateText}>O aplicativo está atualizado!</Text>
                    </View>
                ) : lastCheck && updateResult?.error ? (
                    <View style={[styles.noUpdateCard, { borderColor: '#d32f2f', borderWidth: 1 }]}>
                        <FontAwesome name="times-circle" size={40} color="#d32f2f" />
                        <Text style={[styles.noUpdateText, { color: '#d32f2f' }]}>{statusMessage || 'Erro ao verificar'}</Text>
                    </View>
                ) : null}
            </ScrollView>
        </SafeScreen>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f2f4f8' },
    scrollContent: { padding: 20 },
    section: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, elevation: 2 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#003366', marginBottom: 12 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
    infoLabel: { color: '#666', fontWeight: '500' },
    infoValue: { color: '#333', fontWeight: 'bold', flex: 1, textAlign: 'right', marginLeft: 10 },
    checkButton: {
        backgroundColor: '#003366',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10
    },
    checkButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    lastCheckText: { textAlign: 'center', color: '#888', fontSize: 12 },
    statusContainer: { marginBottom: 20, alignItems: 'center' },
    statusMessage: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#003366',
        marginTop: 4,
        textAlign: 'center'
    },
    resultCard: { borderRadius: 12, padding: 20, borderLeftWidth: 6, elevation: 3, backgroundColor: '#fff' },
    mandatoryCard: { borderLeftColor: '#d32f2f' },
    optionalCard: { borderLeftColor: '#2e7d32' },
    resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    resultTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10, color: '#333', flex: 1, flexWrap: 'wrap' },
    resultVersion: { fontSize: 14, color: '#666', marginBottom: 10 },
    resultNotesTitle: { fontSize: 15, fontWeight: 'bold', color: '#444', marginBottom: 4 },
    resultNotes: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 15, flexShrink: 1, flexWrap: 'wrap' },
    mandatoryBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 8 },
    mandatoryWarning: { color: '#d32f2f', fontWeight: 'bold' },
    actionButton: { padding: 16, borderRadius: 8, alignItems: 'center' },
    actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    incompatibleBox: {
        backgroundColor: '#e3f2fd',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
        flexDirection: 'row',
        gap: 10,
        borderWidth: 1,
        borderColor: '#bbdefb'
    },
    incompatibleText: {
        fontSize: 13,
        color: '#003366',
        flex: 1,
        lineHeight: 18
    },
    apkGuideBox: {
        backgroundColor: '#fff3e0',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#ffe0b2'
    },
    apkGuideTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#e65100',
        marginBottom: 5
    },
    apkGuideText: {
        fontSize: 12,
        color: '#5d4037',
        lineHeight: 18
    },
    noUpdateCard: { alignItems: 'center', padding: 30, backgroundColor: '#fff', borderRadius: 12, elevation: 2 },
    noUpdateText: { marginTop: 10, fontSize: 16, color: '#2e7d32', fontWeight: 'bold' },
    apkInfoBox: {
        backgroundColor: '#f8f9fa',
        padding: 10,
        borderRadius: 8,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#e9ecef'
    },
    apkInfoText: {
        fontSize: 12,
        color: '#6c757d',
        fontFamily: 'monospace'
    }
});

export default AtualizacoesScreen;
