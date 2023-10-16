import * as fs from 'fs';

import { load } from 'js-yaml';

/**
 * yamlファイルをjsonのオブジェクトに変換する
 * @param {string} path ファイルパス
 * @returns {{[key: string]: any}} jsonオブジェクト
 */
export const loadYamlToJson = (
  path: string
): {
  [key: string]: unknown;
} => {
  // yamlファイルを読み込み
  const textYaml = fs.readFileSync(path, 'utf8');
  // jsonのテキストに変換
  const textJson = JSON.stringify(load(textYaml));
  // jsonオブジェクトに変換
  return JSON.parse(textJson);
};
