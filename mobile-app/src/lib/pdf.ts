import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE, getMobileToken } from './api';
import { Alert, Platform } from 'react-native';

/**
 * Downloads official PDF invoice/credit note from backend and opens native share/view sheet
 */
export async function downloadAndSharePdf(
  endpoint: string,
  fileName: string,
): Promise<void> {
  try {
    const token = await getMobileToken();
    const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    if (Platform.OS === 'web') {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to download PDF document');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${fileName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      return;
    }

    const fileUri = `${FileSystem.cacheDirectory}${fileName}.pdf`;
    const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (downloadRes.status !== 200) {
      throw new Error(`Server returned HTTP ${downloadRes.status} for PDF download`);
    }

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(downloadRes.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${fileName}.pdf`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('PDF Saved', `Invoice document saved to ${downloadRes.uri}`);
    }
  } catch (err: any) {
    Alert.alert('PDF Download Failed', err.message || 'Could not download official PDF invoice');
  }
}
