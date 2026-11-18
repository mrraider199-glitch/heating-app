import React, { useRef, useEffect } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles';

const HEAT_PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const isEmber = i % 3 === 0;
  return { id: i, type: isEmber ? 'ember' : 'steam', size: isEmber ? 3 + (i * 7) % 5 : 18 + (i * 13) % 32, startX: (i * 37) % 100, delay: (i * 823) % 6000, duration: 6000 + (i * 1000) % 7000, drift: ((i * 31) % 100) - 50 };
});

function RisingParticle({ type, size, startX, delay, duration, drift }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true, easing: Easing.out(Easing.quad) }), Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [anim, delay, duration]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [50, -900] });
  const translateX = anim.interpolate({ inputRange: [0, 0.4, 0.7, 1], outputRange: [0, drift * 0.5, drift, drift * 0.6] });
  const opacity = anim.interpolate({ inputRange: [0, 0.1, 0.5, 0.9, 1], outputRange: [0, type === 'ember' ? 0.95 : 0.35, type === 'ember' ? 0.7 : 0.25, type === 'ember' ? 0.4 : 0.1, 0] });
  const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1.15, 0.85] });
  const isEmber = type === 'ember';
  return (
    <Animated.View style={{ position: 'absolute', bottom: -20, left: `${startX}%`, width: size, height: size, borderRadius: size / 2, backgroundColor: isEmber ? '#ff9a4a' : 'rgba(255, 210, 180, 0.7)', opacity, transform: [{ translateY }, { translateX }, { scale }], ...(isEmber && { shadowColor: '#ff6b35', shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }) }} />
  );
}

function HeatWave({ delay, duration, top, color, thickness = 30 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })]));
    loop.start();
    return () => loop.stop();
  }, [anim, delay, duration]);
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-150, 150] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.02, 0.07, 0.02] });
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top, left: '-20%', right: '-20%', height: thickness, borderRadius: thickness / 2, backgroundColor: color, opacity, transform: [{ translateX }] }} />;
}

export function HeatingBackground() {
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop1 = Animated.loop(Animated.sequence([Animated.timing(pulse1, { toValue: 1, duration: 2500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }), Animated.timing(pulse1, { toValue: 0, duration: 2500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })]));
    loop1.start();
    const loop2 = Animated.loop(Animated.sequence([Animated.timing(pulse2, { toValue: 1, duration: 3500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }), Animated.timing(pulse2, { toValue: 0, duration: 3500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })]));
    loop2.start();
    return () => { loop1.stop(); loop2.stop(); };
  }, []);
  const glow1Opacity = pulse1.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.22] });
  const glow1Scale = pulse1.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] });
  const glow2Opacity = pulse2.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.30] });
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#0a0505' }} />
      <Animated.View style={{ position: 'absolute', bottom: -250, left: -150, right: -150, height: 650, borderRadius: 325, backgroundColor: '#8b1a00', opacity: glow1Opacity, transform: [{ scale: glow1Scale }] }} />
      <Animated.View style={{ position: 'absolute', bottom: -180, left: -50, right: -50, height: 450, borderRadius: 225, backgroundColor: '#ff4500', opacity: glow2Opacity }} />
      <View style={{ position: 'absolute', bottom: -100, left: '20%', right: '20%', height: 300, borderRadius: 150, backgroundColor: '#ff8c00', opacity: 0.12 }} />
      <HeatWave delay={0} duration={9000} top="15%" color="#ff6b35" thickness={25} />
      <HeatWave delay={2500} duration={11000} top="35%" color="#e74c3c" thickness={35} />
      <HeatWave delay={5000} duration={10000} top="55%" color="#f39c12" thickness={20} />
      {HEAT_PARTICLES.map((p) => <RisingParticle key={p.id} {...p} />)}
    </View>
  );
}

export function FlameLogoGlow() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }), Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })]));
    loop.start();
    return () => loop.stop();
  }, []);
  const scale1 = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] });
  const opacity1 = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.65] });
  const scale2 = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const opacity2 = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.30] });
  return (
    <>
      <Animated.View style={{ position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: '#ff4500', opacity: opacity2, transform: [{ scale: scale2 }] }} />
      <Animated.View style={{ position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: '#ff8c00', opacity: opacity1, transform: [{ scale: scale1 }] }} />
    </>
  );
}

export function AnimatedRoleFooter() {
  const letters = 'BY_ODINOKI'.split('');
  const anims = useRef(letters.map(() => new Animated.Value(0))).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.stagger(70, anims.map(a => Animated.timing(a, { toValue: 6, duration: 500, useNativeDriver: true, easing: Easing.out(Easing.back(2)) }))).start(() => {
      Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }), Animated.timing(glow, { toValue: 0, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })])).start();
    });
  }, []);
  const breatheOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  return (
    <Animated.View style={[styles.roleFooter, { opacity: breatheOpacity }]}>
      <View style={{ flexDirection: 'row' }}>
        {letters.map((ch, i) => {
          const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
          return <Animated.Text key={i} style={{ opacity: anims[i], transform: [{ translateY }], color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 3, textShadowColor: '#ff6b35', textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } }}>{ch}</Animated.Text>;
        })}
      </View>
    </Animated.View>
  );
}