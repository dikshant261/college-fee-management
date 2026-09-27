using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;

namespace CollegeFeeManagement
{
    class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string portStr = Environment.GetEnvironmentVariable("PORT");
            int port = 5000;
            if (!string.IsNullOrEmpty(portStr))
            {
                int.TryParse(portStr, out port);
            }
            if (port <= 0) port = 5000;

            string targetUrl = "http://localhost:" + port;

            // 1. Check if server is already running
            if (IsPortListening("127.0.0.1", port))
            {
                OpenBrowser(targetUrl);
                return;
            }

            // 2. Locate node.exe
            string nodePath = Path.Combine(appDir, "node.exe");
            if (!File.Exists(nodePath))
            {
                nodePath = "node"; // fallback to system PATH
            }

            // 3. Locate server script
            string scriptPath = Path.Combine(appDir, "server", "dist", "index.js");
            string serverWorkingDir = Path.Combine(appDir, "server");
            if (!File.Exists(scriptPath))
            {
                scriptPath = Path.Combine(appDir, "dist", "index.js");
                serverWorkingDir = appDir;
            }

            if (!File.Exists(scriptPath))
            {
                System.Windows.Forms.MessageBox.Show(
                    "Could not find backend server script at:\n" + scriptPath,
                    "College Fee Management - Error",
                    System.Windows.Forms.MessageBoxButtons.OK,
                    System.Windows.Forms.MessageBoxIcon.Error
                );
                return;
            }

            // 4. Start Node.js server silently in background
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodePath;
                psi.Arguments = "\"" + scriptPath + "\"";
                psi.WorkingDirectory = serverWorkingDir;
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                System.Windows.Forms.MessageBox.Show(
                    "Failed to start server:\n" + ex.Message,
                    "College Fee Management - Error",
                    System.Windows.Forms.MessageBoxButtons.OK,
                    System.Windows.Forms.MessageBoxIcon.Error
                );
                return;
            }

            // 5. Poll until port responds or timeout (15 seconds)
            int retries = 60; // 60 * 250ms = 15 seconds
            while (retries > 0)
            {
                Thread.Sleep(250);
                if (IsPortListening("127.0.0.1", port))
                {
                    break;
                }
                retries--;
            }

            // 6. Open Web Application in Default Browser
            OpenBrowser(targetUrl);
        }

        static bool IsPortListening(string host, int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect(host, port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(200);
                    if (!success) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        static void OpenBrowser(string url)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = url;
                psi.UseShellExecute = true;
                Process.Start(psi);
            }
            catch
            {
                try
                {
                    Process.Start("cmd.exe", "/c start " + url);
                }
                catch { }
            }
        }
    }
}
