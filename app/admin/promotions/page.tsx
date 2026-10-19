import { redirect } from 'next/navigation';
import { authOptions } from '@/app/lib/auth-options';
import { prisma } from '@/app/lib/prisma';
import { Megaphone, Plus, Calendar } from 'lucide-react';
import { getAppSession } from '@/app/lib/auth-options';
import type { Session } from 'next-auth'; // ✅ ADD THIS IMPORT

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function PromotionsPage() {
  const session = await getAppSession(); // ✅ ADD TYPE CAST
  
  if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.user?.role || '')) { // ✅ ADD (session.user as any)
    redirect('/login');
  }


  const promotions = await prisma.promotion.findMany({
    orderBy: [{ createdAt: 'desc' }],
  });

  // Group promotions by day
  const promotionsByDay = DAYS.map((day, index) => ({
    day,
    dayIndex: index,
    promotions: promotions.filter(p => p.daysOfWeek.includes(index)),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-teal-500 to-purple-600 rounded-xl">
              <Megaphone className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Weekly Promotions</h1>
              <p className="text-gray-600">Set promotional messages for each day of the week</p>
            </div>
          </div>
        </div>

        {/* Create New Promotion Form */}
        <div className="bg-white rounded-2xl shadow-sm border p-8 mb-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Plus className="w-6 h-6" /> Create New Promotion
          </h2>
          <form action="/api/admin/promotions/create" method="POST" className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Select Day
              </label>
              <select
                name="dayOfWeek"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                {DAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Promotion Message
              </label>
              <textarea
                name="message"
                required
                rows={3}
                placeholder="e.g. 15% off all vitamins this week!"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Optional Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date (Optional)
                </label>
                <input
                  name="startDate"
                  type="date"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for ongoing promotion</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date (Optional)
                </label>
                <input
                  name="endDate"
                  type="date"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for no end date</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="active" defaultChecked className="w-5 h-5 text-teal-600 rounded" />
                <span className="text-sm font-medium">Enable this promotion</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-teal-500 to-purple-600 text-white font-bold rounded-lg hover:shadow-lg transition-shadow"
            >
              Create Promotion
            </button>
          </form>
        </div>

        {/* Promotions by Day */}
        <div className="space-y-6">
          {promotionsByDay.map(({ day, dayIndex, promotions }) => (
            <div key={day} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gradient-to-r from-teal-50 to-purple-50">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-600" />
                  {day}
                  <span className="ml-auto text-sm font-normal text-gray-600">
                    {promotions.filter(p => p.active).length} active
                  </span>
                </h3>
              </div>
              <div className="divide-y">
                {promotions.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <p className="text-sm">No promotions for {day}</p>
                  </div>
                ) : (
                  promotions.map((promo) => (
                    <div key={promo.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className={`font-medium ${promo.active ? 'text-gray-900' : 'text-gray-400'}`}>
                            {promo.message}
                          </p>

                          {/* Date Range */}
                          {(promo.startDate || promo.endDate) && (
                            <p className="text-xs text-gray-500 mt-1">
                              {promo.startDate && `From ${new Date(promo.startDate).toLocaleDateString()}`}
                              {promo.startDate && promo.endDate && ' '}
                              {promo.endDate && `to ${new Date(promo.endDate).toLocaleDateString()}`}
                            </p>
                          )}

                          <p className="text-xs text-gray-400 mt-1">
                            Created {new Date(promo.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${promo.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {promo.active ? 'Active' : 'Disabled'}
                          </span>

                          <form action="/api/admin/promotions/toggle" method="POST" className="inline">
                            <input type="hidden" name="id" value={promo.id} />
                            <input type="hidden" name="active" value={promo.active ? 'false' : 'true'} />
                            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                              {promo.active ? 'Disable' : 'Enable'}
                            </button>
                          </form>

                          <form action="/api/admin/promotions/delete" method="POST" className="inline">
                            <input type="hidden" name="id" value={promo.id} />
                            <button className="text-red-600 hover:text-red-800 text-sm font-medium">
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}