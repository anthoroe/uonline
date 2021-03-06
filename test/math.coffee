# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation; either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.


'use strict'

NS = 'math'; exports[NS] = {}  # namespace
{test, requireCovered, config} = require '../lib/test-utils.coffee'
math = requireCovered __dirname, '../lib/math.coffee'

exports[NS].ap =
	'should return n-th number in arithmetical progression': ->
		test.strictEqual math.ap(1,2,3), 5
		test.strictEqual math.ap(3,6,9), 153
