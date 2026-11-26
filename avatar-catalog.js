const categoryList = [
  ['crew', '工坊伙伴', ['橙衣技师', '巡线质检员', '设备工程师', '值班领班']],
  ['mascot', '动物搭档', ['柴犬搭档', '护目浣熊', '围巾三花', '安全帽鹌鹑']],
  ['robot', '机械伙伴', ['搬运小黄', '圆滚滚助手', '巡检灯塔', '维修圆镜']],
  ['emblem', '班组徽章', ['工坊工具', '电路核心', '机械臂', '加州日落']],
];

export const AVATAR_CATEGORIES = Object.freeze(categoryList.map(([id, label, names], row) => Object.freeze({
  id, label, avatars: Object.freeze(names.map((name, column) => Object.freeze({
    id: id + '-' + (column + 1), label: name, row, column,
  }))),
})));
export const PRESET_AVATARS = Object.freeze(Object.fromEntries(
  AVATAR_CATEGORIES.flatMap(category => category.avatars.map(avatar => [avatar.id, avatar])),
));
export const PHOTO_DATA_LIMIT = 44_000;
export const PHOTO_OUTPUT_SIZE = 320;
const photoPattern = /^data:(image\/(?:webp|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/;
const validSize = (width, height) => width > 0 && height > 0 && width <= PHOTO_OUTPUT_SIZE && height <= PHOTO_OUTPUT_SIZE;
const byte = (binary, index) => binary.charCodeAt(index);

function webpDimensions(binary) {
  if (binary.slice(0, 4) !== 'RIFF' || binary.slice(8, 12) !== 'WEBP' || binary.length < 25) return false;
  const le16 = offset => byte(binary, offset) + 256 * byte(binary, offset + 1);
  const le32 = offset => le16(offset) + 65536 * le16(offset + 2);
  if (le32(4) + 8 !== binary.length) return false;
  let hasFrame = false;
  for (let offset = 12; offset + 8 <= binary.length;) {
    const kind = binary.slice(offset, offset + 4);
    const size = le32(offset + 4);
    const start = offset + 8;
    offset = start + size + (size % 2);
    if (offset > binary.length || kind === 'ANIM' || kind === 'ANMF') return false;
    if (kind === 'VP8X') {
      if (size !== 10 || !validSize((le32(start + 4) & 0xffffff) + 1, (le32(start + 7) & 0xffffff) + 1)) return false;
    }
    if (kind === 'VP8 ') {
      if (hasFrame || size < 10 || binary.slice(start + 3, start + 6) !== '\x9d\x01\x2a'
          || !validSize(le16(start + 6) & 0x3fff, le16(start + 8) & 0x3fff)) return false;
      hasFrame = true;
    }
    if (kind === 'VP8L') {
      if (hasFrame || size < 5 || byte(binary, start) !== 0x2f) return false;
      const flags = le32(start + 1);
      if (!validSize((flags & 0x3fff) + 1, ((flags >>> 14) & 0x3fff) + 1)) return false;
      hasFrame = true;
    }
  }
  return hasFrame;
}

function jpegDimensions(binary) {
  const be16 = offset => 256 * byte(binary, offset) + byte(binary, offset + 1);
  if (be16(0) !== 0xffd8 || be16(binary.length - 2) !== 0xffd9) return false;
  for (let offset = 2; offset + 4 < binary.length;) {
    if (byte(binary, offset++) !== 0xff) return false;
    while (byte(binary, offset) === 0xff) offset++;
    const marker = byte(binary, offset++);
    const length = be16(offset);
    if (length < 2 || offset + length > binary.length || marker === 0xda) return false;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      return length >= 8 && validSize(be16(offset + 5), be16(offset + 3));
    }
    offset += length;
  }
  return false;
}

export function normalizeAvatar(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.kind === 'preset' && typeof value.id === 'string' && Object.hasOwn(PRESET_AVATARS, value.id)) {
    return { kind: 'preset', id: value.id };
  }
  if (value.kind !== 'photo' || typeof value.data !== 'string' || value.data.length > PHOTO_DATA_LIMIT) return null;
  const match = photoPattern.exec(value.data);
  if (!match || match[0].length !== value.data.length || match[2].length % 4 !== 0) return null;
  const binary = atob(match[2]);
  const valid = match[1] === 'image/webp' ? webpDimensions(binary) : jpegDimensions(binary);
  return valid ? { kind: 'photo', data: value.data } : null;
}
