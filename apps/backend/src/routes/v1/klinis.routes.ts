import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireProfiles } from '../../middleware/rbac';
import { validate } from './_validate';
import { defineRoute } from './_registry';
import { idParams } from '../../validation/common';
import { DOKTER, KLINIS, P } from '../../auth/profiles';
import {
  ancSchema,
  catatanSchema,
  imunisasiSchema,
  kbSchema,
  kehamilanSchema,
  klinisBayiSchema,
  klinisLimitSchema,
  kunjunganSchema,
  persalinanSchema,
  rmeListSchema,
  rmeSimpanSchema
} from '../../validation/klinis';
import {
  createAnc,
  createBayi,
  createCatatan,
  createImunisasi,
  createKb,
  createKehamilan,
  createKunjungan,
  createPersalinan,
  listAnc,
  listImunisasi,
  listKb,
  listKehamilan,
  listRme,
  simpanRme
} from '../../controllers/klinis.controller';

const router = Router();

defineRoute(
  router,
  {
    method: 'post',
    path: '/pasien/:id/kunjungan',
    auth: true,
    profiles: DOKTER,
    schemas: { params: idParams, body: kunjunganSchema }
  },
  authenticate,
  requireProfiles(...DOKTER),
  validate({ params: idParams, body: kunjunganSchema }),
  createKunjungan
);

defineRoute(
  router,
  {
    method: 'patch',
    path: '/kunjungan/:id/catatan',
    auth: true,
    profiles: KLINIS,
    schemas: { params: idParams, body: catatanSchema }
  },
  authenticate,
  requireProfiles(...KLINIS),
  validate({ params: idParams, body: catatanSchema }),
  createCatatan
);

defineRoute(
  router,
  {
    method: 'post',
    path: '/pasien/:id/kehamilan/list',
    auth: true,
    profiles: KLINIS,
    schemas: { params: idParams, body: klinisLimitSchema }
  },
  authenticate,
  requireProfiles(...KLINIS),
  validate({ params: idParams, body: klinisLimitSchema }),
  listKehamilan
);

defineRoute(
  router,
  {
    method: 'post',
    path: '/pasien/:id/kehamilan',
    auth: true,
    profiles: KLINIS,
    schemas: { params: idParams, body: kehamilanSchema }
  },
  authenticate,
  requireProfiles(...KLINIS),
  validate({ params: idParams, body: kehamilanSchema }),
  createKehamilan
);

defineRoute(
  router,
  {
    method: 'post',
    path: '/kehamilan/:id/anc/list',
    auth: true,
    profiles: KLINIS,
    schemas: { params: idParams, body: klinisLimitSchema }
  },
  authenticate,
  requireProfiles(...KLINIS),
  validate({ params: idParams, body: klinisLimitSchema }),
  listAnc
);

defineRoute(
  router,
  {
    method: 'post',
    path: '/kehamilan/:id/anc',
    auth: true,
    profiles: KLINIS,
    schemas: { params: idParams, body: ancSchema }
  },
  authenticate,
  requireProfiles(...KLINIS),
  validate({ params: idParams, body: ancSchema }),
  createAnc
);

defineRoute(
  router,
  {
    method: 'post',
    path: '/kehamilan/:id/persalinan',
    auth: true,
    profiles: DOKTER,
    schemas: { params: idParams, body: persalinanSchema }
  },
  authenticate,
  requireProfiles(...DOKTER),
  validate({ params: idParams, body: persalinanSchema }),
  createPersalinan
);

defineRoute(
  router,
  {
    method: 'post',
    path: '/persalinan/:id/bayi',
    auth: true,
    profiles: DOKTER,
    schemas: { params: idParams, body: klinisBayiSchema }
  },
  authenticate,
  requireProfiles(...DOKTER),
  validate({ params: idParams, body: klinisBayiSchema }),
  createBayi
);

defineRoute(
  router,
  {
    method: 'post',
    path: '/pasien/:id/imunisasi/list',
    auth: true,
    profiles: KLINIS,
    schemas: { params: idParams, body: klinisLimitSchema }
  },
  authenticate,
  requireProfiles(...KLINIS),
  validate({ params: idParams, body: klinisLimitSchema }),
  listImunisasi
);

defineRoute(
  router,
  {
    method: 'post',
    path: '/pasien/:id/imunisasi',
    auth: true,
    profiles: KLINIS,
    schemas: { params: idParams, body: imunisasiSchema }
  },
  authenticate,
  requireProfiles(...KLINIS),
  validate({ params: idParams, body: imunisasiSchema }),
  createImunisasi
);

defineRoute(
  router,
  {
    method: 'post',
    path: '/pasien/:id/kb/list',
    auth: true,
    profiles: KLINIS,
    schemas: { params: idParams, body: klinisLimitSchema }
  },
  authenticate,
  requireProfiles(...KLINIS),
  validate({ params: idParams, body: klinisLimitSchema }),
  listKb
);

defineRoute(
  router,
  {
    method: 'post',
    path: '/pasien/:id/kb',
    auth: true,
    profiles: KLINIS,
    schemas: { params: idParams, body: kbSchema }
  },
  authenticate,
  requireProfiles(...KLINIS),
  validate({ params: idParams, body: kbSchema }),
  createKb
);

const RME_AKSES = [...KLINIS, P.ADMIN_LOKAL];

defineRoute(
  router,
  {
    method: 'post',
    path: '/klinis/rme/simpan',
    auth: true,
    profiles: RME_AKSES,
    schemas: { body: rmeSimpanSchema }
  },
  authenticate,
  requireProfiles(...RME_AKSES),
  validate({ body: rmeSimpanSchema }),
  simpanRme
);

defineRoute(
  router,
  {
    method: 'post',
    path: '/klinis/rme/list',
    auth: true,
    profiles: RME_AKSES,
    schemas: { body: rmeListSchema }
  },
  authenticate,
  requireProfiles(...RME_AKSES),
  validate({ body: rmeListSchema }),
  listRme
);

export default router;
