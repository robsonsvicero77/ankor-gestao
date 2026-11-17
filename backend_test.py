import requests
import sys
import json
import io
import os
import tempfile
from datetime import datetime, timedelta

class AnkorGestãoAPITester:
    def __init__(self, base_url=None):
        base_url = base_url or os.environ.get("API_BASE_URL", "http://localhost:8000")
        self.base_url = base_url
        self.api_base = f"{self.base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details and not success:
            print(f"   Details: {details}")

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make HTTP request with proper headers"""
        url = f"{self.api_base}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            return success, response.json() if success else {}, response.status_code

        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_health_check(self):
        """Test API health"""
        success, response, status = self.make_request('GET', '/health')
        self.log_test("Health Check", success, f"Status: {status}, Response: {response}")
        return success

    def test_auth_login(self):
        """Sign in an existing Supabase test account"""
        supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        anon_key = os.environ.get("SUPABASE_ANON_KEY", "")
        email = os.environ.get("SUPABASE_TEST_EMAIL", "")
        password = os.environ.get("SUPABASE_TEST_PASSWORD", "")
        if not all([supabase_url, anon_key, email, password]):
            self.log_test(
                "Supabase Test Login",
                False,
                "Configure SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD",
            )
            return False

        try:
            response = requests.post(
                f"{supabase_url}/auth/v1/token?grant_type=password",
                headers={"apikey": anon_key},
                json={"email": email, "password": password},
                timeout=15,
            )
        except requests.RequestException as error:
            self.log_test("Supabase Test Login", False, f"Auth request failed: {error}")
            return False

        if response.status_code == 200 and response.json().get("access_token"):
            self.token = response.json()["access_token"]
            self.user_data = response.json().get("user")
            self.log_test("Supabase Test Login", True, "Test account authenticated")
            return True
        else:
            self.log_test("Supabase Test Login", False, f"Status: {response.status_code}")
            return False

    def test_auth_me(self):
        """Test get current user"""
        success, response, status = self.make_request('GET', '/auth/me')
        self.log_test("Get Current User", success, f"Status: {status}")
        return success

    def test_set_initial_balance(self):
        """Test setting initial balance"""
        balance_data = {
            "amount_cents": 100000,  # R$ 1000.00
            "note": "Saldo inicial para teste"
        }
        
        success, response, status = self.make_request('POST', '/balance/initial', balance_data, 200)
        
        if success:
            self.log_test("Set Initial Balance", True, f"Balance set: R$ 1000.00")
            return response
        else:
            self.log_test("Set Initial Balance", False, f"Status: {status}, Response: {response}")
            return None

    def test_receivables_crud(self):
        """Test complete CRUD operations for receivables"""
        results = {"create": False, "list": False, "get": False, "update": False, "delete": False}
        receivable_id = None
        
        # 1. Create receivable
        create_data = {
            "description": "Consultoria em TI",
            "client_name": "Empresa ABC",
            "amount_cents": 250000,  # R$ 2500.00
            "due_date": (datetime.now() + timedelta(days=30)).isoformat()
        }
        
        success, response, status = self.make_request('POST', '/receivables', create_data, 200)
        if success and 'id' in response:
            receivable_id = response['id']
            results["create"] = True
            self.log_test("Create Receivable", True, f"ID: {receivable_id}")
        else:
            self.log_test("Create Receivable", False, f"Status: {status}")
            
        # 2. List receivables
        success, response, status = self.make_request('GET', '/receivables')
        if success and isinstance(response, list):
            results["list"] = True
            self.log_test("List Receivables", True, f"Count: {len(response)}")
        else:
            self.log_test("List Receivables", False, f"Status: {status}")
            
        # 3. Get specific receivable
        if receivable_id:
            success, response, status = self.make_request('GET', f'/receivables/{receivable_id}')
            if success:
                results["get"] = True
                self.log_test("Get Receivable", True, f"Retrieved: {response.get('description', '')}")
            else:
                self.log_test("Get Receivable", False, f"Status: {status}")
                
        # 4. Update receivable
        if receivable_id:
            update_data = {
                "description": "Consultoria em TI - Atualizada",
                "amount_cents": 300000
            }
            success, response, status = self.make_request('PUT', f'/receivables/{receivable_id}', update_data)
            if success:
                results["update"] = True
                self.log_test("Update Receivable", True, "Updated successfully")
            else:
                self.log_test("Update Receivable", False, f"Status: {status}")
                
        # 5. Delete receivable (test at the end)
        if receivable_id:
            success, response, status = self.make_request('DELETE', f'/receivables/{receivable_id}', expected_status=200)
            if success:
                results["delete"] = True
                self.log_test("Delete Receivable", True, "Deleted successfully")
            else:
                self.log_test("Delete Receivable", False, f"Status: {status}")
                
        return results, receivable_id

    def test_payables_crud(self):
        """Test complete CRUD operations for payables"""
        results = {"create": False, "list": False, "get": False, "update": False, "delete": False}
        payable_id = None
        
        # 1. Create payable
        create_data = {
            "description": "Aluguel do escritório",
            "category": "aluguel",
            "amount_cents": 150000,  # R$ 1500.00
            "due_date": (datetime.now() + timedelta(days=15)).isoformat()
        }
        
        success, response, status = self.make_request('POST', '/payables', create_data, 200)
        if success and 'id' in response:
            payable_id = response['id']
            results["create"] = True
            self.log_test("Create Payable", True, f"ID: {payable_id}")
        else:
            self.log_test("Create Payable", False, f"Status: {status}")
            
        # 2. List payables
        success, response, status = self.make_request('GET', '/payables')
        if success and isinstance(response, list):
            results["list"] = True
            self.log_test("List Payables", True, f"Count: {len(response)}")
        else:
            self.log_test("List Payables", False, f"Status: {status}")
            
        # 3. Get specific payable
        if payable_id:
            success, response, status = self.make_request('GET', f'/payables/{payable_id}')
            if success:
                results["get"] = True
                self.log_test("Get Payable", True, f"Retrieved: {response.get('description', '')}")
            else:
                self.log_test("Get Payable", False, f"Status: {status}")
                
        # 4. Update payable
        if payable_id:
            update_data = {
                "description": "Aluguel do escritório - Dezembro",
                "amount_cents": 160000
            }
            success, response, status = self.make_request('PUT', f'/payables/{payable_id}', update_data)
            if success:
                results["update"] = True
                self.log_test("Update Payable", True, "Updated successfully")
            else:
                self.log_test("Update Payable", False, f"Status: {status}")
                
        # 5. Delete payable
        if payable_id:
            success, response, status = self.make_request('DELETE', f'/payables/{payable_id}', expected_status=200)
            if success:
                results["delete"] = True
                self.log_test("Delete Payable", True, "Deleted successfully")
            else:
                self.log_test("Delete Payable", False, f"Status: {status}")
                
        return results, payable_id

    def test_mark_as_paid_workflow(self):
        """Test mark as paid functionality and ledger creation"""
        # Create a receivable first
        receivable_data = {
            "description": "Projeto Web",
            "client_name": "Cliente XYZ",
            "amount_cents": 500000,  # R$ 5000.00
            "due_date": datetime.now().isoformat()
        }
        
        success, response, status = self.make_request('POST', '/receivables', receivable_data, 200)
        if not success:
            self.log_test("Mark Receivable Paid - Setup", False, "Failed to create receivable")
            return False
            
        receivable_id = response['id']
        
        # Mark receivable as paid
        success, response, status = self.make_request('POST', f'/receivables/{receivable_id}/mark-paid', expected_status=200)
        if success:
            self.log_test("Mark Receivable as Paid", True, f"Receivable {receivable_id} marked as paid")
        else:
            self.log_test("Mark Receivable as Paid", False, f"Status: {status}")
            return False
            
        # Create a payable
        payable_data = {
            "description": "Conta de luz",
            "category": "servicos",
            "amount_cents": 80000,  # R$ 800.00
            "due_date": datetime.now().isoformat()
        }
        
        success, response, status = self.make_request('POST', '/payables', payable_data, 200)
        if not success:
            self.log_test("Mark Payable Paid - Setup", False, "Failed to create payable")
            return False
            
        payable_id = response['id']
        
        # Mark payable as paid
        success, response, status = self.make_request('POST', f'/payables/{payable_id}/mark-paid', expected_status=200)
        if success:
            self.log_test("Mark Payable as Paid", True, f"Payable {payable_id} marked as paid")
            return True
        else:
            self.log_test("Mark Payable as Paid", False, f"Status: {status}")
            return False

    def test_ledger_operations(self):
        """Test ledger listing"""
        success, response, status = self.make_request('GET', '/ledger')
        if success and isinstance(response, list):
            self.log_test("List Ledger Entries", True, f"Found {len(response)} entries")
            
            # Check if we have expected entry types
            entry_types = [entry.get('entry_type') for entry in response]
            expected_types = ['SALDO_INICIAL', 'RECEITA_PAGA', 'DESPESA_PAGA']
            found_types = [t for t in expected_types if t in entry_types]
            
            if len(found_types) >= 2:  # At least initial balance and one transaction
                self.log_test("Ledger Entry Types", True, f"Found types: {found_types}")
            else:
                self.log_test("Ledger Entry Types", False, f"Missing expected types. Found: {entry_types}")
                
            return True
        else:
            self.log_test("List Ledger Entries", False, f"Status: {status}")
            return False

    def test_dashboard_metrics(self):
        """Test dashboard endpoint with calculated metrics"""
        success, response, status = self.make_request('GET', '/dashboard')
        
        if success:
            expected_fields = [
                'current_balance_cents', 'receivables_30d_cents', 'payables_30d_cents',
                'projected_balance_cents', 'timeline_7d', 'alert_status',
                'pending_receivables_count', 'pending_payables_count'
            ]
            
            missing_fields = [field for field in expected_fields if field not in response]
            
            if not missing_fields:
                self.log_test("Dashboard Metrics", True, f"All fields present. Current balance: {response.get('current_balance_cents', 0)}")
                return True
            else:
                self.log_test("Dashboard Metrics", False, f"Missing fields: {missing_fields}")
                return False
        else:
            self.log_test("Dashboard Metrics", False, f"Status: {status}")
            return False

    def test_onboarding_status(self, expect_needs_onboarding=None):
        """Test onboarding status endpoint"""
        success, response, status = self.make_request('GET', '/onboarding/status')
        
        if success:
            expected_fields = ['has_initial_balance', 'needs_onboarding']
            missing_fields = [field for field in expected_fields if field not in response]
            
            if not missing_fields:
                # If we have a specific expectation, check it
                if expect_needs_onboarding is not None:
                    if response['needs_onboarding'] == expect_needs_onboarding:
                        self.log_test("Onboarding Status", True, f"Correct status: {response}")
                        return True
                    else:
                        self.log_test("Onboarding Status", False, f"Expected needs_onboarding={expect_needs_onboarding}, got {response}")
                        return False
                else:
                    # Just check that response has correct structure
                    self.log_test("Onboarding Status", True, f"Valid status: {response}")
                    return True
            else:
                self.log_test("Onboarding Status", False, f"Missing fields: {missing_fields}")
                return False
        else:
            self.log_test("Onboarding Status", False, f"Status: {status}")
            return False

    def test_export_endpoints(self):
        """Test CSV export endpoints"""
        results = {"receivables": False, "payables": False, "ledger": False}
        
        # Test receivables export
        try:
            url = f"{self.api_base}/export/receivables"
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200 and 'text/csv' in response.headers.get('Content-Type', ''):
                csv_content = response.text
                # Check if CSV has basic structure
                if 'ID' in csv_content and 'Descrição' in csv_content:
                    results["receivables"] = True
                    self.log_test("Export Receivables CSV", True, f"CSV size: {len(csv_content)} chars")
                else:
                    self.log_test("Export Receivables CSV", False, "Invalid CSV structure")
            else:
                self.log_test("Export Receivables CSV", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Export Receivables CSV", False, f"Error: {str(e)}")

        # Test payables export  
        try:
            url = f"{self.api_base}/export/payables"
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200 and 'text/csv' in response.headers.get('Content-Type', ''):
                csv_content = response.text
                if 'ID' in csv_content and 'Descrição' in csv_content:
                    results["payables"] = True
                    self.log_test("Export Payables CSV", True, f"CSV size: {len(csv_content)} chars")
                else:
                    self.log_test("Export Payables CSV", False, "Invalid CSV structure")
            else:
                self.log_test("Export Payables CSV", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Export Payables CSV", False, f"Error: {str(e)}")

        # Test ledger export
        try:
            url = f"{self.api_base}/export/ledger"
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200 and 'text/csv' in response.headers.get('Content-Type', ''):
                csv_content = response.text
                if 'ID' in csv_content and 'Tipo' in csv_content:
                    results["ledger"] = True
                    self.log_test("Export Ledger CSV", True, f"CSV size: {len(csv_content)} chars")
                else:
                    self.log_test("Export Ledger CSV", False, "Invalid CSV structure")
            else:
                self.log_test("Export Ledger CSV", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Export Ledger CSV", False, f"Error: {str(e)}")

        return results

    def test_import_templates(self):
        """Test CSV import template endpoints"""
        results = {"receivables": False, "payables": False}
        
        # Test receivables template
        try:
            url = f"{self.api_base}/import/template/receivables"
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200 and 'text/csv' in response.headers.get('Content-Type', ''):
                csv_content = response.text
                # Check template structure
                if 'Descrição' in csv_content and 'Cliente' in csv_content and 'Valor' in csv_content:
                    results["receivables"] = True
                    self.log_test("Import Template Receivables", True, "Valid template structure")
                else:
                    self.log_test("Import Template Receivables", False, "Invalid template structure")
            else:
                self.log_test("Import Template Receivables", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Import Template Receivables", False, f"Error: {str(e)}")

        # Test payables template
        try:
            url = f"{self.api_base}/import/template/payables"
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(url, headers=headers)
            
            if response.status_code == 200 and 'text/csv' in response.headers.get('Content-Type', ''):
                csv_content = response.text
                if 'Descrição' in csv_content and 'Categoria' in csv_content and 'Valor' in csv_content:
                    results["payables"] = True
                    self.log_test("Import Template Payables", True, "Valid template structure")
                else:
                    self.log_test("Import Template Payables", False, "Invalid template structure")
            else:
                self.log_test("Import Template Payables", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Import Template Payables", False, f"Error: {str(e)}")

        return results

    def test_import_csv(self):
        """Test CSV import functionality"""
        results = {"receivables": False, "payables": False}
        
        # Test receivables import
        try:
            # Create test CSV content
            csv_content = """Descrição,Cliente,Valor (R$),Data Vencimento
Teste Import,Cliente Teste,1000,15/01/2026
Projeto API,Empresa ABC,2500,20/01/2026"""
            
            files = {'file': ('test_receivables.csv', csv_content, 'text/csv')}
            headers = {'Authorization': f'Bearer {self.token}'}
            
            url = f"{self.api_base}/import/receivables"
            response = requests.post(url, files=files, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                if 'imported' in result and result['imported'] >= 0:
                    results["receivables"] = True
                    self.log_test("Import Receivables CSV", True, f"Imported: {result['imported']}/{result['total_rows']}")
                else:
                    self.log_test("Import Receivables CSV", False, f"Invalid response: {result}")
            else:
                self.log_test("Import Receivables CSV", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Import Receivables CSV", False, f"Error: {str(e)}")

        # Test payables import
        try:
            csv_content = """Descrição,Categoria,Valor (R$),Data Vencimento
Teste Despesa,servicos,500,10/01/2026
Aluguel Office,aluguel,1500,05/01/2026"""
            
            files = {'file': ('test_payables.csv', csv_content, 'text/csv')}
            headers = {'Authorization': f'Bearer {self.token}'}
            
            url = f"{self.api_base}/import/payables"
            response = requests.post(url, files=files, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                if 'imported' in result and result['imported'] >= 0:
                    results["payables"] = True
                    self.log_test("Import Payables CSV", True, f"Imported: {result['imported']}/{result['total_rows']}")
                else:
                    self.log_test("Import Payables CSV", False, f"Invalid response: {result}")
            else:
                self.log_test("Import Payables CSV", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("Import Payables CSV", False, f"Error: {str(e)}")

        return results

    def test_ledger_filters(self):
        """Test ledger filtering functionality"""
        results = {"entry_type": False, "direction": False, "date_range": False}
        
        # Test entry_type filter
        success, response, status = self.make_request('GET', '/ledger?entry_type=SALDO_INICIAL')
        if success and isinstance(response, list):
            # Check if all entries are SALDO_INICIAL type
            if all(entry.get('entry_type') == 'SALDO_INICIAL' for entry in response):
                results["entry_type"] = True
                self.log_test("Ledger Filter by Type", True, f"Found {len(response)} SALDO_INICIAL entries")
            else:
                self.log_test("Ledger Filter by Type", False, "Filter not working correctly")
        else:
            self.log_test("Ledger Filter by Type", False, f"Status: {status}")

        # Test direction filter
        success, response, status = self.make_request('GET', '/ledger?direction=CREDIT')
        if success and isinstance(response, list):
            if all(entry.get('direction') == 'CREDIT' for entry in response):
                results["direction"] = True
                self.log_test("Ledger Filter by Direction", True, f"Found {len(response)} CREDIT entries")
            else:
                self.log_test("Ledger Filter by Direction", False, "Filter not working correctly")
        else:
            self.log_test("Ledger Filter by Direction", False, f"Status: {status}")

        # Test date range filter
        start_date = (datetime.now() - timedelta(days=1)).isoformat()
        end_date = (datetime.now() + timedelta(days=1)).isoformat()
        success, response, status = self.make_request('GET', f'/ledger?start_date={start_date}&end_date={end_date}')
        if success and isinstance(response, list):
            results["date_range"] = True
            self.log_test("Ledger Filter by Date Range", True, f"Found {len(response)} entries in date range")
        else:
            self.log_test("Ledger Filter by Date Range", False, f"Status: {status}")

        return results

    def test_email_reminders(self):
        """Test email reminder functionality"""
        # First create a receivable to send reminder for
        receivable_data = {
            "description": "Reminder Test",
            "client_name": "Test Client",
            "amount_cents": 100000,
            "due_date": (datetime.now() + timedelta(days=5)).isoformat()
        }
        
        success, response, status = self.make_request('POST', '/receivables', receivable_data, 200)
        if not success:
            self.log_test("Email Reminder - Setup", False, "Failed to create receivable for reminder test")
            return False
            
        receivable_id = response['id']
        
        # Test sending reminder
        reminder_data = {
            "receivable_id": receivable_id,
            "custom_message": "This is a test reminder message"
        }
        
        success, response, status = self.make_request('POST', '/reminders/send', reminder_data, 200)
        if success:
            expected_fields = ['success', 'message']
            if all(field in response for field in expected_fields):
                self.log_test("Send Email Reminder", True, f"Reminder response: {response['message']}")
                return True
            else:
                self.log_test("Send Email Reminder", False, f"Invalid response format: {response}")
                return False
        else:
            self.log_test("Send Email Reminder", False, f"Status: {status}")
            return False

    def run_all_tests(self):
        """Run complete test suite including new features"""
        print("🚀 Starting AnkorGestão API Test Suite (Iteration 2)")
        print("=" * 55)
        
        # Test sequence
        if not self.test_health_check():
            print("❌ Health check failed, stopping tests")
            return False
            
        if not self.test_auth_login():
            print("❌ Login failed, stopping tests")  
            return False
            
        self.test_auth_me()
        
        # Test onboarding status before setting initial balance
        print("\n🔄 Testing Onboarding Flow...")
        self.test_onboarding_status(expect_needs_onboarding=True)  # Should show needs_onboarding=true initially
        
        if not self.test_set_initial_balance():
            print("❌ Initial balance setup failed")
            
        # Test onboarding status after setting initial balance
        self.test_onboarding_status(expect_needs_onboarding=False)  # Should show needs_onboarding=false now
            
        # CRUD tests
        print("\n📝 Testing CRUD Operations...")
        self.test_receivables_crud()
        self.test_payables_crud()
        
        # Integration tests
        print("\n⚙️  Testing Integration Features...")
        self.test_mark_as_paid_workflow()
        self.test_ledger_operations()
        self.test_dashboard_metrics()
        
        # New feature tests
        print("\n🆕 Testing New Features (Iteration 2)...")
        self.test_export_endpoints()
        self.test_import_templates() 
        self.test_import_csv()
        self.test_ledger_filters()
        self.test_email_reminders()
        
        # Summary
        print("\n" + "=" * 55)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        
        if success_rate >= 80:
            print(f"✅ Overall Status: PASS ({success_rate:.1f}%)")
            return True
        else:
            print(f"❌ Overall Status: FAIL ({success_rate:.1f}%)")
            return False

def main():
    """Main test runner"""
    tester = AnkorGestãoAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results_path = os.path.join(tempfile.gettempdir(), 'backend_test_results.json')
    with open(results_path, 'w') as f:
        json.dump({
            'success': success,
            'tests_run': tester.tests_run,
            'tests_passed': tester.tests_passed,
            'results': tester.test_results,
            'timestamp': datetime.now().isoformat()
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())