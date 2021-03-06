"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug = require('debug')('parse: SPS');
class Rgsp {
    static rbsp_skip(chunk, offset, len) {
        if (len <= 2) {
            return chunk.slice(offset, offset + len);
        }
        const arr = new Uint8Array(len);
        let idx = 2;
        for (let i = offset + 2; i < offset + len; i++) {
            if (chunk.readUInt8(i - 2) === 0x00 &&
                chunk.readUInt8(i - 1) === 0x00 &&
                chunk.readUInt8(i) === 0x03) {
                continue;
            }
            arr[idx] = chunk.readUInt8(i);
            idx++;
        }
        arr[0] = chunk.readUInt8(offset);
        arr[1] = chunk.readUInt8(offset + 1);
        return Buffer.from(arr.slice(0, idx));
    }
    static parse_sps(chunk, offset, sps_length) {
        chunk = Rgsp.rbsp_skip(chunk, offset, sps_length);
        offset = 0;
        const profile_idc = chunk.readUInt8(offset);
        offset += 1;
        const d = chunk.readUInt8(offset);
        offset += 1;
        const set0Flag = d & 128;
        const set1Flag = d & 64;
        const set2Flag = d & 32;
        const reserved_zero = d & 63;
        if (reserved_zero !== 0) {
            debug(`WARN: reserved_zero ${reserved_zero} uneqeue 0`);
        }
        const levelIdc = chunk.readUInt8(offset);
        offset += 1;
        let chroma_format_idc = 1;
        let separate_colour_plane_flag = null;
        let chroma_format_table = [0, 420, 422, 444];
        let chroma_format = 420;
        let bit_depth_chroma_minus8 = null;
        let bit_depth_luma_minus8 = null;
        let qpprime_y_zero_transform_flag = null;
        let log2_max_pic_order_cnt_lsb_minus_4 = null;
        let delta_pic_order_always_zero_flag = null;
        let offset_for_non_ref_pic = null;
        let offset_for_top_to_bottom_field = null;
        let offset_for_ref_frame = null;
        let video_format = null;
        let k = this.readUE(chunk, offset * 8);
        const seq_parameter_set_id = k.data;
        let bitOffset = k.bitOffset;
        if (profile_idc === 100 || profile_idc === 110 || profile_idc === 122 ||
            profile_idc === 244 || profile_idc === 44 || profile_idc === 83 ||
            profile_idc === 86 || profile_idc === 118 || profile_idc === 128 ||
            profile_idc === 138 || profile_idc === 144) {
            k = this.readUE(chunk, bitOffset);
            chroma_format_idc = k.data;
            bitOffset = k.bitOffset;
            if (chroma_format_idc === 3) {
                separate_colour_plane_flag = this.readBit(chunk, bitOffset);
                bitOffset += 1;
            }
            if (chroma_format_idc <= 3) {
                chroma_format = chroma_format_table[chroma_format_idc];
            }
            k = this.readUE(chunk, bitOffset);
            bitOffset = k.bitOffset;
            bit_depth_luma_minus8 = k.data + 8;
            k = this.readUE(chunk, bitOffset);
            bitOffset = k.bitOffset;
            bit_depth_chroma_minus8 = k.data;
            bitOffset += 1;
            const seq_scaling_matrix_present_flag = this.readBit(chunk, bitOffset) === 1;
            bitOffset += 1;
            if (seq_scaling_matrix_present_flag) {
                let scaling_list_count = (chroma_format_idc !== 3) ? 8 : 12;
                for (let i = 0; i < scaling_list_count; i++) {
                    let seq_scaling_list_present_flag = this.readBit(chunk, bitOffset) === 1;
                    bitOffset += 1;
                    if (seq_scaling_list_present_flag) {
                        if (i < 6) {
                            bitOffset = this.skipScalingList(chunk, 16, bitOffset);
                        }
                        else {
                            bitOffset = this.skipScalingList(chunk, 64, bitOffset);
                        }
                    }
                }
            }
            k = this.readUE(chunk, bitOffset);
            bitOffset = k.bitOffset;
            const log2_max_frame_num_mimus4 = k.data;
            k = this.readUE(chunk, bitOffset);
            bitOffset = k.bitOffset;
            const pic_order_cnt_type = k.data;
            if (pic_order_cnt_type === 0) {
                k = this.readUE(chunk, bitOffset);
                bitOffset = k.bitOffset;
                log2_max_pic_order_cnt_lsb_minus_4 = k.data;
            }
            else if (pic_order_cnt_type === 1) {
                delta_pic_order_always_zero_flag = this.readBit(chunk, bitOffset);
                bitOffset += 1;
                k = this.readSE(chunk, bitOffset);
                bitOffset = k.bitOffset;
                offset_for_non_ref_pic = k.data;
                k = this.readSE(chunk, bitOffset);
                bitOffset = k.bitOffset;
                offset_for_top_to_bottom_field = k.data;
                k = this.readUE(chunk, bitOffset);
                bitOffset = k.bitOffset;
                let num_ref_frames_in_pic_order_cnt_cycle = k.data;
                for (let i = 0; i < num_ref_frames_in_pic_order_cnt_cycle; i++) {
                    bitOffset = this.readSE(chunk, bitOffset).bitOffset;
                }
            }
            k = this.readUE(chunk, bitOffset);
            bitOffset = k.bitOffset;
            let max_num_ref_frames = k.data;
            let gaps_in_frame_num_value_allowed_flag = this.readBit(chunk, bitOffset);
            bitOffset += 1;
            k = this.readUE(chunk, bitOffset);
            bitOffset = k.bitOffset;
            let pic_width_in_mbs_minus1 = k.data;
            k = this.readUE(chunk, bitOffset);
            bitOffset = k.bitOffset;
            let pic_height_in_map_units_minus1 = k.data;
            let frame_mbs_only_flag = this.readBit(chunk, bitOffset);
            bitOffset += 1;
            if (frame_mbs_only_flag === 0) {
                bitOffset += 1;
            }
            bitOffset += 1;
            let frame_cropping_flag = this.readBit(chunk, bitOffset) === 1;
            bitOffset += 1;
            let frame_crop_left_offset = 0;
            let frame_crop_right_offset = 0;
            let frame_crop_top_offset = 0;
            let frame_crop_bottom_offset = 0;
            if (frame_cropping_flag) {
                k = this.readUE(chunk, bitOffset);
                bitOffset = k.bitOffset;
                frame_crop_left_offset = k.data;
                k = this.readUE(chunk, bitOffset);
                bitOffset = k.bitOffset;
                frame_crop_right_offset = k.data;
                k = this.readUE(chunk, bitOffset);
                bitOffset = k.bitOffset;
                frame_crop_top_offset = k.data;
                k = this.readUE(chunk, bitOffset);
                bitOffset = k.bitOffset;
                frame_crop_bottom_offset = k.data;
            }
            let sar_width = 1, sar_height = 1;
            let fps = 0, fps_fixed = true, fps_num = 0, fps_den = 0;
            let vui_parameters_present_flag = this.readBit(chunk, bitOffset) === 1;
            bitOffset += 1;
            if (vui_parameters_present_flag) {
                let aspect_ratio_info_present_flag = this.readBit(chunk, bitOffset) === 1;
                bitOffset += 1;
                if (aspect_ratio_info_present_flag) {
                    let aspect_ratio_idc = this.readBit(chunk, bitOffset, 8);
                    bitOffset += 8;
                    let sar_w_table = [1, 12, 10, 16, 40, 24, 20, 32, 80, 18, 15, 64, 160, 4, 3, 2];
                    let sar_h_table = [1, 11, 11, 11, 33, 11, 11, 11, 33, 11, 11, 33, 99, 3, 2, 1];
                    if (aspect_ratio_idc > 0 && aspect_ratio_idc < 16) {
                        sar_width = sar_w_table[aspect_ratio_idc - 1];
                        sar_height = sar_h_table[aspect_ratio_idc - 1];
                    }
                    else if (aspect_ratio_idc === 255) {
                        sar_width = this.readBit(chunk, bitOffset, 8) << 8 | this.readBit(chunk, bitOffset + 8, 8);
                        ;
                        sar_height = this.readBit(chunk, bitOffset + 16, 8) << 8 | this.readBit(chunk, bitOffset + 24, 8);
                        ;
                        bitOffset += 24;
                    }
                }
                let overscan_info_present_flag = this.readBit(chunk, bitOffset) === 1;
                bitOffset += 1;
                if (overscan_info_present_flag) {
                    bitOffset += 1;
                }
                let video_signal_type_present_flag = this.readBit(chunk, bitOffset) === 1;
                bitOffset += 1;
                if (video_signal_type_present_flag) {
                    bitOffset += 4;
                    let colour_description_present_flag = this.readBit(chunk, bitOffset) === 1;
                    bitOffset += 1;
                    if (colour_description_present_flag) {
                        bitOffset += 24;
                    }
                }
                let chroma_loc_info_present_flag = this.readBit(chunk, bitOffset) === 1;
                bitOffset += 1;
                if (chroma_loc_info_present_flag) {
                    bitOffset = this.readUE(chunk, bitOffset).bitOffset;
                    bitOffset = this.readUE(chunk, bitOffset).bitOffset;
                }
                let timing_info_present_flag = this.readBit(chunk, bitOffset) === 1;
                bitOffset += 1;
                if (timing_info_present_flag) {
                    let num_units_in_tick = this.readBit(chunk, bitOffset, 32);
                    bitOffset += 32;
                    let time_scale = this.readBit(chunk, bitOffset, 32);
                    bitOffset += 32;
                    fps_fixed = this.readBit(chunk, bitOffset) === 1;
                    bitOffset += 1;
                    fps_num = time_scale;
                    fps_den = num_units_in_tick * 2;
                    fps = fps_num / fps_den;
                }
            }
            let sarScale = 1;
            if (sar_width !== 1 || sar_height !== 1) {
                sarScale = sar_width / sar_height;
            }
            let crop_unit_x = 0, crop_unit_y = 0;
            if (chroma_format_idc === 0) {
                crop_unit_x = 1;
                crop_unit_y = 2 - frame_mbs_only_flag;
            }
            else {
                let sub_wc = (chroma_format_idc === 3) ? 1 : 2;
                let sub_hc = (chroma_format_idc === 1) ? 2 : 1;
                crop_unit_x = sub_wc;
                crop_unit_y = sub_hc * (2 - frame_mbs_only_flag);
            }
            let codec_width = (pic_width_in_mbs_minus1 + 1) * 16;
            let codec_height = (2 - frame_mbs_only_flag) * ((pic_height_in_map_units_minus1 + 1) * 16);
            codec_width -= (frame_crop_left_offset + frame_crop_right_offset) * crop_unit_x;
            codec_height -= (frame_crop_top_offset + frame_crop_bottom_offset) * crop_unit_y;
            let present_width = Math.ceil(codec_width * sarScale);
            return {
                profile_string: this.getProfileString(profile_idc),
                level_string: this.getLevelString(levelIdc),
                bit_depth: bit_depth_luma_minus8,
                chroma_format: chroma_format,
                chroma_format_string: this.getChromaFormatString(chroma_format),
                frame_rate: {
                    fixed: fps_fixed,
                    fps: fps,
                    fps_den: fps_den,
                    fps_num: fps_num
                },
                sar_ratio: {
                    width: sar_width,
                    height: sar_height
                },
                codec_size: {
                    width: codec_width,
                    height: codec_height
                },
                present_size: {
                    width: present_width,
                    height: codec_height
                }
            };
        }
    }
    static parse_pps(chunk, offset, pps_length) {
        chunk = Rgsp.rbsp_skip(chunk, offset, pps_length);
        let bitOffset = 0;
        let k = this.readUE(chunk, bitOffset);
        bitOffset = k.bitOffset;
        let pic_parameter_set_id = k.data;
        k = this.readUE(chunk, bitOffset);
        bitOffset = k.bitOffset;
        let seq_parameter_set_id = k.data;
        const entropy_coding_mode_flag = this.readBit(chunk, bitOffset);
        bitOffset += 1;
        const pic_order_present_flag = this.readBit(chunk, bitOffset);
        bitOffset += 1;
        k = this.readUE(chunk, bitOffset);
        bitOffset = k.bitOffset;
        let num_slice_groups_minus1 = k.data;
        if (num_slice_groups_minus1 > 0) {
            k = this.readUE(chunk, bitOffset);
            bitOffset = k.bitOffset;
            let slice_group_map_type = k.data;
            if (slice_group_map_type === 0) {
            }
            else if (slice_group_map_type === 2) {
            }
            else if (slice_group_map_type === 3 ||
                slice_group_map_type === 4 ||
                slice_group_map_type === 5) {
                bitOffset += 1;
                k = this.readUE(chunk, bitOffset);
                bitOffset = k.bitOffset;
                let slice_group_change_rate_minus1 = k.data;
            }
            else if (slice_group_map_type === 6) {
                k = this.readUE(chunk, bitOffset);
                bitOffset = k.bitOffset;
                let pic_size_in_map_units_minus1 = k.data;
                for (let i = 0; i < pic_size_in_map_units_minus1; i++) {
                    k = this.readUE(chunk, bitOffset);
                    bitOffset = k.bitOffset;
                }
            }
        }
        k = this.readUE(chunk, bitOffset);
        bitOffset = k.bitOffset;
        let num_ref_idx_10_active_minus1 = k.data;
        k = this.readUE(chunk, bitOffset);
        bitOffset = k.bitOffset;
        let num_ref_idx_11_active_minus1 = k.data;
        let weighted_pred_flag = this.readBit(chunk, bitOffset);
        bitOffset += 1;
        let weighted_bipred_idc = this.readBit(chunk, bitOffset, 2);
        bitOffset += 2;
        k = this.readSE(chunk, bitOffset);
        bitOffset = k.bitOffset;
        let pic_init_qp_minus26 = k.data;
        k = this.readSE(chunk, bitOffset);
        bitOffset = k.bitOffset;
        let pic_init_qs_minus26 = k.data;
        k = this.readSE(chunk, bitOffset);
        bitOffset = k.bitOffset;
        let chroma_qp_index_offset = k.data;
        let deblocking_filter_control_present_flag = this.readBit(chunk, bitOffset);
        bitOffset += 1;
        let constrained_intra_pred_flag = this.readBit(chunk, bitOffset);
        bitOffset += 1;
        let redundant_pic_cnt_present_flag = this.readBit(chunk, bitOffset);
        bitOffset += 1;
    }
    static readUE(chunk, bitOffset) {
        let leadingzerobits = 0;
        let rightV = 0;
        while (this.readBit(chunk, bitOffset) === 0) {
            leadingzerobits++;
            bitOffset++;
        }
        bitOffset++;
        if (leadingzerobits !== 0) {
            rightV = this.readBit(chunk, bitOffset, leadingzerobits);
            bitOffset += leadingzerobits;
        }
        return {
            data: Math.pow(2, leadingzerobits) - 1 + rightV,
            bitOffset: bitOffset,
        };
    }
    static readSE(chunk, bitOffset) {
        const d = this.readUE(chunk, bitOffset);
        if (d.data & 0x01) {
            d.data = (d.data + 1) >>> 1;
        }
        else {
            d.data = -1 * (d.data >>> 1);
        }
        return d;
    }
    static readBit(chunk, bitOffset, len = 1) {
        const offset = Math.floor(bitOffset / 8);
        const endOffset = Math.floor((bitOffset + len - 1) / 8);
        const l = endOffset - offset;
        if ((offset + l) > chunk.length) {
            throw new Error(`read bit outside, bitOffset: ${bitOffset}, len: ${chunk.length}`);
        }
        let v = '';
        for (let i = 0; i < len; i++) {
            v += '1';
        }
        const check = parseInt(v, 2);
        let d = chunk.readUInt8(offset);
        for (let i = 1; i <= l; i++) {
            d = d << 8;
            d += chunk.readUInt8(offset + i);
        }
        let byteMove = (8 - 1 - bitOffset % 8);
        len = (len % 8) - 1;
        len = len > 0 ? len : 8 + len;
        if (byteMove >= len) {
            byteMove -= len;
        }
        else {
            byteMove = 8 - (len - byteMove);
        }
        return d >>> byteMove & check;
    }
    static skipScalingList(chunk, count, bitOffset) {
        let last_scale = 8, next_scale = 8;
        let delta_scale = 0;
        for (let i = 0; i < count; i++) {
            if (next_scale !== 0) {
                const d = this.readSE(chunk, bitOffset);
                bitOffset = d.bitOffset;
                next_scale = (last_scale + d.data + 256) % 256;
            }
            last_scale = (next_scale === 0) ? last_scale : next_scale;
        }
        return bitOffset;
    }
    static getProfileString(profile_idc) {
        switch (profile_idc) {
            case 66:
                return 'Baseline';
            case 77:
                return 'Main';
            case 88:
                return 'Extended';
            case 100:
                return 'High';
            case 110:
                return 'High10';
            case 122:
                return 'High422';
            case 244:
                return 'High444';
            default:
                return 'Unknown';
        }
    }
    static getLevelString(level_idc) {
        return (level_idc / 10).toFixed(1);
    }
    static getChromaFormatString(chroma) {
        switch (chroma) {
            case 420:
                return '4:2:0';
            case 422:
                return '4:2:2';
            case 444:
                return '4:4:4';
            default:
                return 'Unknown';
        }
    }
}
exports.default = Rgsp;
//# sourceMappingURL=Rgsp.js.map