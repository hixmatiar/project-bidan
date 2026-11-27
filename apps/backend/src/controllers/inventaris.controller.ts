import { asyncHandler } from '../middleware/asyncHandler';
import respond from '../http/respond';
import { InventarisService } from '../services/inventaris.service';
import type {
  BatchBody,
  ObatBody,
  ObatUpdateBody,
  ResepPengeluaranBody,
  RestockBody,
  StokListInput
} from '../validation/inventaris';

const service = new InventarisService();

export const list = asyncHandler(async (req, res) => {
  const body = req.validated?.body as StokListInput;
  return respond.ok(res, await service.list(body));
});

export const createObat = asyncHandler(async (req, res) => {
  const body = req.validated?.body as ObatBody;
  return respond.created(res, await service.createObat(body, req.auth?.stafId ?? null));
});

export const updateObat = asyncHandler(async (req, res) => {
  const { id } = req.validated?.params as { id: string };
  const body = req.validated?.body as ObatUpdateBody;
  return respond.ok(res, await service.updateObat(id, body));
});

export const restock = asyncHandler(async (req, res) => {
  const { id } = req.validated?.params as { id: string };
  const body = req.validated?.body as RestockBody;
  return respond.created(res, await service.restock(id, body, req.auth?.stafId ?? null));
});

export const listRiwayat = asyncHandler(async (req, res) => {
  const { id } = req.validated?.params as { id: string };
  const body = req.validated?.body as StokListInput;
  return respond.ok(res, await service.listRiwayat(id, body));
});

export const listBatch = asyncHandler(async (req, res) => {
  const { id } = req.validated?.params as { id: string };
  return respond.ok(res, await service.listBatch(id));
});

export const createBatch = asyncHandler(async (req, res) => {
  const { id } = req.validated?.params as { id: string };
  const body = req.validated?.body as BatchBody;
  return respond.created(res, await service.createBatch(id, body));
});

export const listGudang = asyncHandler(async (_req, res) => {
  return respond.ok(res, await service.listGudang());
});

export const listStokGudang = asyncHandler(async (req, res) => {
  const { id } = req.validated?.params as { id: string };
  return respond.ok(res, await service.listStokGudang(id));
});

export const pengeluaranResep = asyncHandler(async (req, res) => {
  const { id } = req.validated?.params as { id: string };
  const body = req.validated?.body as ResepPengeluaranBody;
  return respond.ok(res, await service.pengeluaranResep(id, body, req.auth?.stafId ?? null));
});

export default {
  list,
  createObat,
  updateObat,
  restock,
  listRiwayat,
  listBatch,
  createBatch,
  listGudang,
  listStokGudang,
  pengeluaranResep
};
