import { asyncHandler } from '../middleware/asyncHandler';
import respond from '../http/respond';
import { KeuanganService } from '../services/keuangan.service';
import type { BayarBody, HargaBody, RefParams, TagihanListInput } from '../validation/keuangan';

const service = new KeuanganService();

export const detailTagihan = asyncHandler(async (req, res) => {
  const { id } = req.validated?.params as { id: string };
  return respond.ok(res, await service.detailTagihan(id, req.body));
});

export const bayar = asyncHandler(async (req, res) => {
  const { id } = req.validated?.params as { id: string };
  const body = req.validated?.body as BayarBody;
  return respond.created(res, await service.bayar(id, body, req.auth?.stafId ?? null));
});

export const listTagihan = asyncHandler(async (req, res) => {
  const body = req.validated?.body as TagihanListInput;
  return respond.ok(res, await service.list(body));
});

export const rekap = asyncHandler(async (req, res) => {
  const body = req.validated?.body as TagihanListInput;
  return respond.ok(res, await service.rekap(body));
});

export const listHarga = asyncHandler(async (_req, res) => {
  return respond.ok(res, await service.listHarga());
});

export const setHarga = asyncHandler(async (req, res) => {
  const params = req.validated?.params as RefParams;
  const body = req.validated?.body as HargaBody;
  return respond.created(res, await service.setHarga(params, body, req.auth?.stafId ?? null));
});

export const riwayatHarga = asyncHandler(async (req, res) => {
  const params = req.validated?.params as RefParams;
  return respond.ok(res, await service.riwayatHarga(params));
});

export default {
  detailTagihan,
  bayar,
  listTagihan,
  rekap,
  listHarga,
  setHarga,
  riwayatHarga
};
