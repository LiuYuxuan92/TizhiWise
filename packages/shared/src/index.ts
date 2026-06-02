/**
 * @tizhice/shared —— 跨端共享类型、枚举与 DTO 的入口。
 *
 * 本包是 H5、管理后台与 API 之间的契约单一来源（single source of truth）：
 *   - 领域枚举（体质、测评、订单、内容、配置等）见 `./enums`
 *   - 跨服务 DTO 接口（Question、AnswerValue、ConstitutionResult、Report、
 *     PaymentOrder 等）见 `./dto`
 */

/** 共享包版本标识，便于运行期排查跨端契约一致性。 */
export const SHARED_PACKAGE_VERSION = '0.1.0';

export * from './enums.js';
export * from './dto/index.js';
