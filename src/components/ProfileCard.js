import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getRank } from '../utils';
import styles from '../styles';

export default function ProfileCard({ profile, onSave, isMaster, commissionAmount = 0 }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSurname, setEditSurname] = useState('');
  const [editPhoto, setEditPhoto] = useState(null);

  const rank = isMaster ? getRank(profile.ordersDone) : null;
  const borderColor = isMaster ? rank?.color : '#3498db';

  const startEdit = () => {
    setEditName(profile.name || '');
    setEditSurname(profile.surname || '');
    setEditPhoto(profile.avatar || null);
    setEditing(true);
  };

  const save = () => {
    onSave({ ...profile, name: editName.trim() || profile.name, surname: editSurname.trim(), avatar: editPhoto });
    setEditing(false);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Нужно разрешение', 'Разрешите доступ к галерее');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setEditPhoto(result.assets[0].uri);
  };

  return (
    <View style={styles.profileCard}>
      <TouchableOpacity style={[styles.profileAvatar, { borderColor }]} onPress={editing ? pickPhoto : undefined} disabled={!editing} activeOpacity={editing ? 0.7 : 1}>
        {(editing ? editPhoto : profile.avatar) ? (
          <Image source={{ uri: editing ? editPhoto : profile.avatar }} style={styles.avatarImage} />
        ) : (
          <Ionicons name="person" size={40} color={borderColor} />
        )}
        {editing && (
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        )}
        {!editing && isMaster && rank && (
          <View style={[styles.rankBadge, { backgroundColor: rank.color }]}>
            <Ionicons name={rank.icon} size={14} color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      {editing ? (
        <View style={{ width: '100%', paddingHorizontal: 20 }}>
          <TextInput style={styles.profileInput} value={editName} onChangeText={setEditName} placeholder="Имя" placeholderTextColor="#666" autoCapitalize="words" />
          <TextInput style={styles.profileInput} value={editSurname} onChangeText={setEditSurname} placeholder="Фамилия" placeholderTextColor="#666" autoCapitalize="words" />
          <View style={styles.profileEditActions}>
            <TouchableOpacity style={styles.profileEditBtnCancel} onPress={() => setEditing(false)}>
              <Text style={styles.profileEditBtnCancelText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileEditBtnSave} onPress={save}>
              <Ionicons name="checkmark" size={16} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.profileEditBtnSaveText}>Сохранить</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.profileName}>{profile.name}{profile.surname ? ` ${profile.surname}` : ''}</Text>
          <Text style={styles.profilePhone}>{profile.phone}</Text>
          {isMaster && rank && (
            <View style={[styles.rankPill, { backgroundColor: rank.color + '22', borderColor: rank.color }]}>
              <Ionicons name={rank.icon} size={16} color={rank.color} />
              <Text style={[styles.rankPillText, { color: rank.color }]}>{rank.title}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.editProfileBtn} onPress={startEdit}>
            <Ionicons name="pencil" size={14} color="#3498db" />
            <Text style={styles.editProfileBtnText}>Редактировать профиль</Text>
          </TouchableOpacity>
        </>
      )}

      {!editing && (
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{isMaster ? profile.ordersDone : profile.ordersCount}</Text>
            <Text style={styles.statLabel}>заказов</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="star" size={18} color="#f39c12" style={{ marginRight: 4 }} />
              <Text style={styles.statValue}>{profile.rating}</Text>
            </View>
            <Text style={styles.statLabel}>{isMaster ? profile.totalRatings : profile.reviewsCount} отзывов</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{isMaster ? `${profile.balance.toLocaleString('ru-RU')}₽` : `${profile.tips.toLocaleString('ru-RU')}₽`}</Text>
            <Text style={styles.statLabel}>{isMaster ? 'заработано' : 'чаевых'}</Text>
          </View>
        </View>
      )}

      {!editing && isMaster && (
        <View style={styles.profileCommissionNotice}>
          <Ionicons name="wallet" size={14} color="#f39c12" />
          <Text style={styles.profileCommissionText}>
            Комиссия сервиса: <Text style={{ color: '#f39c12', fontWeight: '700' }}>{commissionAmount.toLocaleString('ru-RU')} ₽</Text>
            <Text style={{ color: '#888' }}> · 7% до 6000 ₽ • 5% свыше</Text>
          </Text>
        </View>
      )}
    </View>
  );
}