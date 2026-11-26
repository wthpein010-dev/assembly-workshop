export const FACE_LABELS = ['标准', '清秀', '英气', '稳重', '棱角', '柔和', '利落', '沉静'];
export const HAIR_STYLES = {
  female: ['齐肩短发', '后束马尾', '松软波浪', '短卷发', '侧分短发', '侧辫', '长直发', '高发髻'],
  male: ['侧分短发', '利落寸头', '短卷发', '后梳蓬发', '中长波浪', '渐层短发', '束发', '斜刘海'],
};
export const HAIR_LABELS = HAIR_STYLES.female;
export const TONES = ['原生', '暖铜', '深棕'];

export function portraitLayers({ gender, face, hair, tone }) {
  const offset = gender === 'male' ? 2 : 0;
  const position = index => [index % 4 * 100 / 3 + '%', (offset + Math.floor(index / 4)) * 100 / 3 + '%'];
  const [faceX, faceY] = position(face);
  const [hairX, hairY] = position(hair);
  return { faceX, faceY, hairX, hairY, tone };
}
