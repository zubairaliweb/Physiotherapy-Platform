import { Router } from 'express'
import Appointment from '../models/Appointment.js'
import Patient from '../models/Patient.js'
import Payment from '../models/Payment.js'
import PatientPackage from '../models/PatientPackage.js'
import requireAuth from '../middleware/requireAuth.js'
import requireRole from '../middleware/requireRole.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

router.get('/', async (_req, res, next) => {
  try {
    const timezone = process.env.CLINIC_TIME_ZONE || 'Asia/Karachi'
    const start = new Date()
    start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0); start.setUTCMonth(start.getUTCMonth() - 11)
    const [monthlyAppointments, byService, statuses, monthlyPatients, activePatientIds, returningPatientIds, newPatients, monthlyRevenue, revenueByService, revenueByPackage, paymentStatuses, packages] = await Promise.all([
      Appointment.aggregate([{ $match: { appointmentDate: { $gte: start } } }, { $group: { _id: { $dateToString: { date: '$appointmentDate', format: '%Y-%m', timezone } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Appointment.aggregate([{ $group: { _id: '$service', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 12 }]),
      Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Patient.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: { $dateToString: { date: '$createdAt', format: '%Y-%m', timezone } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Appointment.distinct('patientId', { patientId: { $ne: null }, appointmentDate: { $gte: new Date(Date.now() - 90 * 86400000) } }),
      Appointment.aggregate([{ $match: { patientId: { $ne: null } } }, { $group: { _id: '$patientId', visits: { $sum: 1 } } }, { $match: { visits: { $gte: 2 } } }, { $count: 'total' }]),
      Patient.countDocuments({ createdAt: { $gte: start } }),
      Payment.aggregate([{ $match: { status: 'Paid', paymentDate: { $gte: start } } }, { $group: { _id: { month: { $dateToString: { date: '$paymentDate', format: '%Y-%m', timezone } }, currency: '$currency' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { '_id.month': 1 } }]),
      Payment.aggregate([{ $match: { status: 'Paid', serviceName: { $ne: '' } } }, { $group: { _id: { service: '$serviceName', currency: '$currency' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }, { $limit: 12 }]),
      Payment.aggregate([{ $match: { status: 'Paid', packageCatalogId: { $ne: null } } }, { $group: { _id: { package: '$packageCatalogId', currency: '$currency' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }, { $limit: 12 }]),
      Payment.aggregate([{ $group: { _id: { status: '$status', currency: '$currency' }, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      PatientPackage.countDocuments({ status: 'Active' }),
    ])
    const statusCounts = Object.fromEntries(statuses.map(item => [item._id, item.count]))
    res.json({
      periodStart: start.toISOString(),
      kpis: { appointments: await Appointment.countDocuments(), patients: await Patient.countDocuments(), activePatients: activePatientIds.length, returningPatients: returningPatientIds[0]?.total || 0, newPatients, activePackages: packages },
      monthlyAppointments, monthlyPatients, byService,
      appointmentOutcomes: { completed: statusCounts.Completed || 0, cancelled: statusCounts.Cancelled || 0, pending: statusCounts.Pending || 0, confirmed: statusCounts.Confirmed || 0 },
      monthlyRevenue, revenueByService, revenueByPackage, paymentStatuses,
    })
  } catch (error) { next(error) }
})

export default router
