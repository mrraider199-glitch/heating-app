import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Alert, Image, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { formatSec } from '../utils';
import { WA_CHAT_BG, WA_BUBBLE_MINE, WA_BUBBLE_OTHER, WA_GREEN, WA_TICK } from '../constants';
import styles from '../styles';

export function VideoPlayerFull({ uri }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; try { p.play(); } catch (e) {} });
  return <VideoView player={player} style={styles.videoFull} contentFit="contain" nativeControls />;
}

export function VideoMessage({ uri }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.videoPreview} onPress={() => setOpen(true)} activeOpacity={0.85}>
        <View style={styles.videoPreviewPlay}><Ionicons name="play" size={28} color="#fff" /></View>
        <View style={styles.videoPreviewLabel}><Ionicons name="videocam" size={11} color="#fff" /><Text style={styles.videoPreviewLabelText}>Видео</Text></View>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.videoModal}>
          <TouchableOpacity style={styles.videoModalClose} onPress={() => setOpen(false)}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
          {open && <VideoPlayerFull uri={uri} />}
        </View>
      </Modal>
    </>
  );
}

const WAVE_BARS = 30;
const WAVE_HEIGHTS = Array.from({ length: WAVE_BARS }, (_, i) => { const seed = (i * 7 + 3) % 11; return 6 + (seed % 5) * 3 + (i % 3) * 2; });

export function VoiceMessage({ uri, duration }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  useEffect(() => { if (uri) { try { player.replace({ uri }); } catch (e) {} } }, [uri, player]);
  const handlePlayPause = () => {
    try {
      if (status.playing) player.pause();
      else { if (status.duration > 0 && status.currentTime >= status.duration) player.seekTo(0); player.play(); }
    } catch (e) { Alert.alert('Ошибка', String(e.message || e)); }
  };
  const total = Math.round(duration || status.duration || 0);
  const current = Math.floor(status.currentTime || 0);
  const progress = total > 0 ? Math.min(1, current / total) : 0;
  const playedBars = Math.floor(progress * WAVE_BARS);
  return (
    <View style={styles.voiceRow}>
      <TouchableOpacity onPress={handlePlayPause} style={styles.voicePlayBtn} activeOpacity={0.7}><Ionicons name={status.playing ? 'pause' : 'play'} size={18} color="#fff" /></TouchableOpacity>
      <View style={styles.voiceWaveWrap}>
        {WAVE_HEIGHTS.map((h, i) => (<View key={i} style={[styles.voiceWaveBar, { height: h, backgroundColor: i < playedBars ? '#53bdeb' : 'rgba(83,189,235,0.35)' }]} />))}
      </View>
      <Text style={styles.voiceDuration}>{formatSec(current)}/{formatSec(total)}</Text>
    </View>
  );
}

export function AttachPanel({ visible, onPhoto, onVideo, onClose }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(340)).current;
  const photoAnim = useRef(new Animated.Value(0)).current;
  const videoAnim = useRef(new Animated.Value(0)).current;
  const photoPress = useRef(new Animated.Value(1)).current;
  const videoPress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }),
        Animated.spring(photoAnim, { toValue: 1, delay: 90, useNativeDriver: true, speed: 18, bounciness: 10 }),
        Animated.spring(videoAnim, { toValue: 1, delay: 170, useNativeDriver: true, speed: 18, bounciness: 10 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 340, duration: 200, useNativeDriver: true }),
        Animated.timing(photoAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(videoAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  const photoScale = photoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const videoScale = videoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.attachOverlay, { opacity }]}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.attachSheet, { transform: [{ translateY }] }]}>
        <View style={styles.attachGrabber} />
        <Text style={styles.attachSheetTitle}>Прикрепить</Text>
        <View style={styles.attachTilesRow}>
          <Animated.View style={{ opacity: photoAnim, transform: [{ scale: photoScale }, { scale: photoPress }] }}>
            <TouchableOpacity activeOpacity={1} onPressIn={() => Animated.spring(photoPress, { toValue: 0.9, useNativeDriver: true, speed: 30 }).start()} onPressOut={() => Animated.spring(photoPress, { toValue: 1, useNativeDriver: true, speed: 30 }).start()} onPress={onPhoto} style={styles.attachTileWrap}>
              <View style={[styles.attachTile, { backgroundColor: '#0ea5e9' }]}><Ionicons name="images" size={22} color="#fff" /></View>
              <Text style={styles.attachTileLabel}>Фото</Text>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={{ opacity: videoAnim, transform: [{ scale: videoScale }, { scale: videoPress }] }}>
            <TouchableOpacity activeOpacity={1} onPressIn={() => Animated.spring(videoPress, { toValue: 0.9, useNativeDriver: true, speed: 30 }).start()} onPressOut={() => Animated.spring(videoPress, { toValue: 1, useNativeDriver: true, speed: 30 }).start()} onPress={onVideo} style={styles.attachTileWrap}>
              <View style={[styles.attachTile, { backgroundColor: '#e74c3c' }]}><Ionicons name="videocam" size={22} color="#fff" /></View>
              <Text style={styles.attachTileLabel}>Видео</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export function ChatWallpaper() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={{ flex: 1, backgroundColor: WA_CHAT_BG }} />
      <View style={{ position: 'absolute', top: -90, left: -70, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(0,168,132,0.07)' }} />
      <View style={{ position: 'absolute', bottom: -120, right: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(0,168,132,0.05)' }} />
    </View>
  );
}